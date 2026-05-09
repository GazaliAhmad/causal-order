import type {
  EventAnomaly,
  EventEnvelope,
  OrderOptions,
  ValidationResult,
  ValidatedEventEnvelope,
} from "../types.js"
import { compareBigInt } from "../internal/utils.js"
import { compareByHlc } from "../compare/hlcCompare.js"
import { validateEvent } from "../validate/validateEvent.js"

type EventValidationRecord<T> = {
  event: EventEnvelope<T>
  validation: ValidationResult<ValidatedEventEnvelope<T>>
}

const FUTURE_TIMESTAMP_MESSAGE = "Event clock is in the future relative to the validator clock"
const MISSING_SEQUENCE_MESSAGE = "Event is missing sequence metadata"
const DUPLICATE_EVENT_MESSAGE = "Duplicate event id detected"
const SEQUENCE_REGRESSION_MESSAGE = "Sequence regressed for node"
const SAME_NODE_SEQUENCE_CONFLICT_MESSAGE = "Sequence conflict detected for node"
const CAUSAL_INVERSION_MESSAGE = "Parent event appears after child by HLC order"

type FirstSeenEventRecord<T> = {
  event: EventEnvelope<T>
  validation: ValidationResult<ValidatedEventEnvelope<T>>
}

export function detectAnomalies<T>(
  events: EventEnvelope<T>[],
  options?: Pick<OrderOptions<T>, "maxClockDriftMs"> & {
    validations?: EventValidationRecord<T>[]
  },
): EventAnomaly<T>[] {
  const anomalies: EventAnomaly<T>[] = []
  const seenEventIds = new Map<string, FirstSeenEventRecord<T>>()
  const waitingChildrenByParentId = new Map<string, EventValidationRecord<T>[]>()
  const lastSequenceByNode = new Map<string, bigint>()
  const sequenceOwnerByNode = new Map<string, Map<bigint, EventEnvelope<T>>>()
  const validationOptions: { maxClockDriftMs?: bigint } = {}
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }
  const validations = options?.validations ?? events.map((event) => ({
    event,
    validation: validateEvent(event, validationOptions),
  }))

  function maybePushCausalInversion(
    parentRecord: FirstSeenEventRecord<T>,
    childRecord: EventValidationRecord<T>,
  ): void {
    if (!parentRecord.validation.valid || !childRecord.validation.valid) {
      return
    }

    if (compareByHlc(parentRecord.event.clock, childRecord.event.clock) === "after") {
      anomalies.push({
        type: "causal_inversion",
        severity: "warning",
        event: childRecord.event,
        relatedEvents: [parentRecord.event],
        message: CAUSAL_INVERSION_MESSAGE,
      })
    }
  }

  for (const { event, validation } of validations) {
    if (!validation.valid) {
      anomalies.push({
        type: "invalid_clock",
        severity: "error",
        event,
        message: validation.errors.map((error) => error.message).join("; "),
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

      if (warning.code === "missing_sequence") {
        anomalies.push({
          type: "missing_sequence",
          severity: "info",
          event,
          message: MISSING_SEQUENCE_MESSAGE,
        })
      }
    }

    const currentRecord: FirstSeenEventRecord<T> = {
      event,
      validation,
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

    if (event.sequence !== undefined) {
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
  }

  return anomalies
}
