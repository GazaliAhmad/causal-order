import type { HlcTimestamp } from "../types.js"
import { assertValidHlcTimestamp } from "../internal/utils.js"

export function parseHlc(value: string): HlcTimestamp {
  const parts = value.split(":")
  if (parts.length !== 3) {
    throw new Error(`Invalid HLC string: ${value}`)
  }

  const physicalTimeRaw = parts[0]
  const logicalCounterRaw = parts[1]
  const nodeId = parts[2]

  if (physicalTimeRaw === undefined || logicalCounterRaw === undefined || nodeId === undefined) {
    throw new Error(`Invalid HLC string: ${value}`)
  }

  let physicalTimeMs: bigint
  try {
    physicalTimeMs = BigInt(physicalTimeRaw)
  } catch {
    throw new Error(`Invalid HLC physicalTimeMs: ${physicalTimeRaw}`)
  }

  const logicalCounter = Number.parseInt(logicalCounterRaw, 10)
  const clock: HlcTimestamp = {
    physicalTimeMs,
    logicalCounter,
    nodeId,
  }

  assertValidHlcTimestamp(clock)
  return clock
}
