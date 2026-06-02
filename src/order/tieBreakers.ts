import type { TieBreaker } from "../types.js"

export const DEFAULT_TIE_BREAKER = "event_id"

export function getTieBreaker<T>(tieBreaker?: TieBreaker<T>): TieBreaker<T> {
  return tieBreaker ?? DEFAULT_TIE_BREAKER
}
