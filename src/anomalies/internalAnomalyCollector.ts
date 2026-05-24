import type {
  EventAnomaly,
  EventEnvelope,
  HlcTimestamp,
  ValidationError,
  ValidationResult,
  ValidatedEventEnvelope,
} from "../types.js"
import { compareBigInt } from "../internal/utils.js"

type CausalRecord<T> = {
  event: EventEnvelope<T>
  valid: boolean
}

const FUTURE_TIMESTAMP_MESSAGE = "Event clock is in the future relative to the validator clock"
const MISSING_SEQUENCE_MESSAGE = "Event is missing sequence metadata"
const DUPLICATE_EVENT_MESSAGE = "Duplicate event id detected"
const SEQUENCE_REGRESSION_MESSAGE = "Sequence regressed for node"
const SAME_NODE_SEQUENCE_CONFLICT_MESSAGE = "Sequence conflict detected for node"
const CAUSAL_INVERSION_MESSAGE = "Parent event appears after child by HLC order"

function isClockAfter(
  a: HlcTimestamp,
  b: HlcTimestamp,
): boolean {
  if (a.physicalTimeMs !== b.physicalTimeMs) {
    return a.physicalTimeMs > b.physicalTimeMs
  }

  if (a.logicalCounter !== b.logicalCounter) {
    return a.logicalCounter > b.logicalCounter
  }

  return a.nodeId > b.nodeId
}

function joinValidationMessages(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return ""
  }

  let message = errors[0]?.message ?? ""
  for (let index = 1; index < errors.length; index += 1) {
    const error = errors[index]
    if (error !== undefined) {
      message += `; ${error.message}`
    }
  }

  return message
}

export function pushSingleEventValidationAnomalies<T>(
  anomalies: EventAnomaly<T>[],
  event: EventEnvelope<T>,
  validation: ValidationResult<ValidatedEventEnvelope<T>>,
): void {
  if (!validation.valid) {
    anomalies.push({
      type: "invalid_clock",
      severity: "error",
      event,
      message: joinValidationMessages(validation.errors),
    })
  }

  for (const warning of validation.warnings) {
    if (warning.code === "future_timestamp") {
      anomalies.push({
        type: "future_timestamp",
        severity: "warning",
        event,
        message: FUTURE_TIMESTAMP_MESSAGE,
      })
    }
  }

  if (event.sequence === undefined) {
    anomalies.push({
      type: "missing_sequence",
      severity: "info",
      event,
      message: MISSING_SEQUENCE_MESSAGE,
    })
  }
}

export function createAnomalyCollector<T>(): {
  anomalies: EventAnomaly<T>[]
  observe: (
    event: EventEnvelope<T>,
    validation: ValidationResult<ValidatedEventEnvelope<T>>,
  ) => void
} {
  const anomalies: EventAnomaly<T>[] = []
  const seenEventIds = new Map<string, CausalRecord<T>>()
  const waitingChildrenByParentId = new Map<string, CausalRecord<T>[]>()
  const lastSequenceByNode = new Map<string, bigint>()
  const sequenceOwnerByNode = new Map<string, Map<bigint, EventEnvelope<T>>>()

  const maybePushCausalInversion = (
    parentRecord: CausalRecord<T>,
    childRecord: CausalRecord<T>,
  ): void => {
    if (!parentRecord.valid || !childRecord.valid) {
      return
    }

    if (isClockAfter(parentRecord.event.clock, childRecord.event.clock)) {
      anomalies.push({
        type: "causal_inversion",
        severity: "warning",
        event: childRecord.event,
        relatedEvents: [parentRecord.event],
        message: CAUSAL_INVERSION_MESSAGE,
      })
    }
  }

  const observe = (
    event: EventEnvelope<T>,
    validation: ValidationResult<ValidatedEventEnvelope<T>>,
  ): void => {
    pushSingleEventValidationAnomalies(anomalies, event, validation)

    const currentRecord: CausalRecord<T> = {
      event,
      valid: validation.valid,
    }
    const duplicate = seenEventIds.get(event.id)
    if (duplicate !== undefined) {
      anomalies.push({
        type: "duplicate_event",
        severity: "error",
        event,
        relatedEvents: [duplicate.event],
        message: DUPLICATE_EVENT_MESSAGE,
      })
    } else {
      seenEventIds.set(event.id, currentRecord)

      const waitingChildren = waitingChildrenByParentId.get(event.id)
      if (waitingChildren !== undefined) {
        for (const childRecord of waitingChildren) {
          maybePushCausalInversion(currentRecord, childRecord)
        }
        waitingChildrenByParentId.delete(event.id)
      }
    }

    if (event.parentEventId !== undefined) {
      const parentRecord = seenEventIds.get(event.parentEventId)
      if (parentRecord !== undefined) {
        maybePushCausalInversion(parentRecord, currentRecord)
      } else {
        const waitingChildren = waitingChildrenByParentId.get(event.parentEventId) ?? []
        waitingChildren.push(currentRecord)
        waitingChildrenByParentId.set(event.parentEventId, waitingChildren)
      }
    }

    if (event.sequence === undefined) {
      return
    }

    const lastSequence = lastSequenceByNode.get(event.nodeId)
    if (lastSequence !== undefined && compareBigInt(event.sequence, lastSequence) < 0) {
      anomalies.push({
        type: "sequence_regression",
        severity: "warning",
        event,
        message: SEQUENCE_REGRESSION_MESSAGE,
      })
    }

    let sequenceOwner = sequenceOwnerByNode.get(event.nodeId)
    if (sequenceOwner === undefined) {
      sequenceOwner = new Map<bigint, EventEnvelope<T>>()
      sequenceOwnerByNode.set(event.nodeId, sequenceOwner)
    }
    const owner = sequenceOwner.get(event.sequence)
    if (owner !== undefined && owner.id !== event.id) {
      anomalies.push({
        type: "same_node_sequence_conflict",
        severity: "error",
        event,
        relatedEvents: [owner],
        message: SAME_NODE_SEQUENCE_CONFLICT_MESSAGE,
      })
    } else {
      sequenceOwner.set(event.sequence, event)
    }

    lastSequenceByNode.set(event.nodeId, event.sequence)
  }

  return {
    anomalies,
    observe,
  }
}
