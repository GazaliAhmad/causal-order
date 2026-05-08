import type { EventEnvelope, TieBreaker, ValidatedEventEnvelope } from "../types.js"
import {
  compareBigInt,
  compareNullableBigInt,
  compareString,
  getEventTime,
  getValidatedEventTime,
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

  if (tieBreaker !== undefined) {
    const tieResult = applyTieBreaker(a, b, tieBreaker)
    if (tieResult !== 0) {
      return tieResult
    }
  }

  const node = compareString(a.nodeId, b.nodeId)
  if (node !== 0) {
    return node
  }

  const id = compareString(a.id, b.id)
  if (id !== 0) {
    return id
  }

  return 0
}

export function compareValidatedDeterministically<T>(
  a: ValidatedEventEnvelope<T>,
  b: ValidatedEventEnvelope<T>,
  tieBreaker?: TieBreaker<T>,
): number {
  const physical = compareBigInt(
    getValidatedEventTime(a),
    getValidatedEventTime(b),
  )
  if (physical !== 0) {
    return physical
  }

  const logical = compareNullableBigInt(a.sequence, b.sequence)
  if (logical !== undefined && logical !== 0) {
    return logical
  }

  if (tieBreaker !== undefined) {
    const tieResult = applyTieBreaker(a, b, tieBreaker)
    if (tieResult !== 0) {
      return tieResult
    }
  }

  const node = compareString(a.nodeId, b.nodeId)
  if (node !== 0) {
    return node
  }

  const id = compareString(a.id, b.id)
  if (id !== 0) {
    return id
  }

  return 0
}
