import type { CausalOrdering, HlcTimestamp } from "../types.js"
import { assertValidHlcTimestamp, compareBigInt, compareString } from "../internal/utils.js"

export function compareByHlc(a: HlcTimestamp, b: HlcTimestamp): CausalOrdering {
  try {
    assertValidHlcTimestamp(a)
    assertValidHlcTimestamp(b)
  } catch {
    return "unknown"
  }

  const physical = compareBigInt(a.physicalTimeMs, b.physicalTimeMs)
  if (physical < 0) {
    return "before"
  }
  if (physical > 0) {
    return "after"
  }

  if (a.logicalCounter < b.logicalCounter) {
    return "before"
  }
  if (a.logicalCounter > b.logicalCounter) {
    return "after"
  }

  const node = compareString(a.nodeId, b.nodeId)
  if (node < 0) {
    return "before"
  }
  if (node > 0) {
    return "after"
  }

  return "equal"
}

/**
 * @deprecated Use `compareByHlc()` instead. This alias remains for compatibility
 * in the published `0.5.0` release line, but new code should prefer the more
 * explicit HLC-specific name.
 */
export function compareClocks(a: HlcTimestamp, b: HlcTimestamp): CausalOrdering {
  return compareByHlc(a, b)
}
