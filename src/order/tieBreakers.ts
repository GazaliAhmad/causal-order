import type { EventEnvelope, TieBreaker } from "../types.js"
import { applyTieBreaker } from "../compare/deterministicCompare.js"

export const DEFAULT_TIE_BREAKER = "event_id"

export function getTieBreaker<T>(tieBreaker?: TieBreaker<T>): TieBreaker<T> {
  return tieBreaker ?? DEFAULT_TIE_BREAKER
}

/**
 * @deprecated Prefer `compareDeterministically()` for public deterministic
 * fallback comparison. This helper remains for compatibility during the
 * published `0.5.0` release line.
 */
export function compareWithTieBreaker<T>(
  a: EventEnvelope<T>,
  b: EventEnvelope<T>,
  tieBreaker?: TieBreaker<T>,
): number {
  return applyTieBreaker(a, b, getTieBreaker(tieBreaker))
}
