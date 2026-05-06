import type { EventEnvelope, TieBreaker } from "../types.js"
import {
  compareBigInt,
  compareNullableBigInt,
  compareString,
  getEventTime,
} from "../internal/utils.js"

export function applyTieBreaker<T>(
  a: EventEnvelope<T>,
  b: EventEnvelope<T>,
  tieBreaker?: TieBreaker<T>,
): number {
  if (typeof tieBreaker === "function") {
    return tieBreaker(a, b)
  }

  switch (tieBreaker) {
    case "sequence": {
      const result = compareNullableBigInt(a.sequence, b.sequence)
      return result ?? compareString(a.id, b.id)
    }
    case "ingestion_order": {
      const result = compareNullableBigInt(a.ingestedAt, b.ingestedAt)
      return result ?? compareString(a.id, b.id)
    }
    case "event_id":
      return compareString(a.id, b.id)
    case "node_id":
      return compareString(a.nodeId, b.nodeId)
    default:
      return compareString(a.id, b.id)
  }
}

export function compareDeterministically<T>(
  a: EventEnvelope<T>,
  b: EventEnvelope<T>,
  tieBreaker?: TieBreaker<T>,
): number {
  const timeA = getEventTime(a)
  const timeB = getEventTime(b)

  if (timeA !== undefined && timeB !== undefined) {
    const physical = compareBigInt(timeA, timeB)
    if (physical !== 0) {
      return physical
    }
  }

  const logical = compareNullableBigInt(a.sequence, b.sequence)
  if (logical !== undefined && logical !== 0) {
    return logical
  }

  const node = compareString(a.nodeId, b.nodeId)
  if (node !== 0) {
    return node
  }

  const id = compareString(a.id, b.id)
  if (id !== 0) {
    return id
  }

  return applyTieBreaker(a, b, tieBreaker)
}
