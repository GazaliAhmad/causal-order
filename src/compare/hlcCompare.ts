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
