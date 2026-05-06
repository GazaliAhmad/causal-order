import type { EventAnomaly, EventEnvelope, OrderOptions } from "../types.js"
import { compareBigInt } from "../internal/utils.js"
import { compareByCausality } from "../compare/causalCompare.js"
import { compareByHlc } from "../compare/hlcCompare.js"
import { validateEvent } from "../validate/validateEvent.js"

export function detectAnomalies<T>(
  events: EventEnvelope<T>[],
  options?: Pick<OrderOptions<T>, "maxClockDriftMs">,
): EventAnomaly<T>[] {
  const anomalies: EventAnomaly<T>[] = []
  const seenEventIds = new Map<string, EventEnvelope<T>>()
  const lastSequenceByNode = new Map<string, bigint>()
  const sequenceOwner = new Map<string, EventEnvelope<T>>()

  for (const event of events) {
    const validationOptions: { maxClockDriftMs?: bigint } = {}
    if (options?.maxClockDriftMs !== undefined) {
      validationOptions.maxClockDriftMs = options.maxClockDriftMs
    }

    const validation = validateEvent(event, validationOptions)

    if (!validation.valid) {
      anomalies.push({
        type: "invalid_clock",
        severity: "error",
        event,
        message: validation.errors.map((error) => error.message).join("; "),
      })
    }

    if (validation.warnings.some((warning) => warning.code === "future_timestamp")) {
      anomalies.push({
        type: "future_timestamp",
        severity: "warning",
        event,
        message: "Event clock is in the future relative to the validator clock",
      })
    }

    if (validation.warnings.some((warning) => warning.code === "missing_sequence")) {
      anomalies.push({
        type: "missing_sequence",
        severity: "info",
        event,
        message: "Event is missing sequence metadata",
      })
    }

    const duplicate = seenEventIds.get(event.id)
    if (duplicate !== undefined) {
      anomalies.push({
        type: "duplicate_event",
        severity: "error",
        event,
        relatedEvents: [duplicate],
        message: `Duplicate event id detected: ${event.id}`,
      })
    } else {
      seenEventIds.set(event.id, event)
    }

    if (event.sequence !== undefined) {
      const lastSequence = lastSequenceByNode.get(event.nodeId)
      if (lastSequence !== undefined && compareBigInt(event.sequence, lastSequence) < 0) {
        anomalies.push({
          type: "sequence_regression",
          severity: "warning",
          event,
          message: `Sequence regressed for node ${event.nodeId}`,
        })
      }

      const sequenceKey = `${event.nodeId}:${event.sequence.toString()}`
      const owner = sequenceOwner.get(sequenceKey)
      if (owner !== undefined && owner.id !== event.id) {
        anomalies.push({
          type: "same_node_sequence_conflict",
          severity: "error",
          event,
          relatedEvents: [owner],
          message: `Sequence conflict for node ${event.nodeId} at ${event.sequence.toString()}`,
        })
      } else {
        sequenceOwner.set(sequenceKey, event)
      }

      lastSequenceByNode.set(event.nodeId, event.sequence)
    }
  }

  for (const event of events) {
    if (event.parentEventId === undefined) {
      continue
    }

    const parent = seenEventIds.get(event.parentEventId)
    if (parent === undefined) {
      continue
    }

    const causal = compareByCausality(parent, event)
    const hlc = compareByHlc(parent.clock, event.clock)
    if (causal === "before" && hlc === "after") {
      anomalies.push({
        type: "causal_inversion",
        severity: "warning",
        event,
        relatedEvents: [parent],
        message: `Parent event ${parent.id} appears after child ${event.id} by HLC order`,
      })
    }
  }

  return anomalies
}
