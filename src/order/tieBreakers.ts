import type { EventEnvelope, TieBreaker } from "../types.js"
import { applyTieBreaker } from "../compare/deterministicCompare.js"

export const DEFAULT_TIE_BREAKER = "event_id"

export function getTieBreaker<T>(tieBreaker?: TieBreaker<T>): TieBreaker<T> {
  return tieBreaker ?? DEFAULT_TIE_BREAKER
}

export function compareWithTieBreaker<T>(
  a: EventEnvelope<T>,
  b: EventEnvelope<T>,
  tieBreaker?: TieBreaker<T>,
): number {
  return applyTieBreaker(a, b, getTieBreaker(tieBreaker))
}
