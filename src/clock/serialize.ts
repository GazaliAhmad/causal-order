import type { HlcTimestamp } from "../types.js"
import { assertValidHlcTimestamp } from "../internal/utils.js"

export function serializeHlc(clock: HlcTimestamp): string {
  assertValidHlcTimestamp(clock)
  return `${clock.physicalTimeMs}:${clock.logicalCounter}:${clock.nodeId}`
}
