import type { EventEnvelope, EventId, HlcTimestamp, NodeId } from "../types.js"
import type { ValidatedEventEnvelope } from "../types.js"

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value)
}

export function isBigInt(value: unknown): value is bigint {
  return typeof value === "bigint"
}

export function compareBigInt(a: bigint, b: bigint): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

export function compareString(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

export function compareNullableBigInt(
  a: bigint | undefined,
  b: bigint | undefined,
): number | undefined {
  if (a === undefined || b === undefined) {
    return undefined
  }
  return compareBigInt(a, b)
}

export function assertValidNodeId(nodeId: unknown): asserts nodeId is NodeId {
  if (!isNonEmptyString(nodeId)) {
    throw new Error("Invalid nodeId")
  }
}

export function assertValidEventId(eventId: unknown): asserts eventId is EventId {
  if (!isNonEmptyString(eventId)) {
    throw new Error("Invalid eventId")
  }
}

export function assertValidHlcTimestamp(clock: unknown): asserts clock is HlcTimestamp {
  if (typeof clock !== "object" || clock === null) {
    throw new Error("Invalid HLC timestamp")
  }

  const candidate = clock as Partial<HlcTimestamp>

  if (!isBigInt(candidate.physicalTimeMs)) {
    throw new Error("Invalid HLC physicalTimeMs")
  }

  if (!isSafeInteger(candidate.logicalCounter) || candidate.logicalCounter < 0) {
    throw new Error("Invalid HLC logicalCounter")
  }

  assertValidNodeId(candidate.nodeId)
}

export function getEventTime<T>(event: EventEnvelope<T>): bigint | undefined {
  try {
    assertValidHlcTimestamp(event.clock)
    return event.clock.physicalTimeMs
  } catch {
    return event.ingestedAt
  }
}

export function getValidatedEventTime<T>(
  event: ValidatedEventEnvelope<T>,
): bigint {
  return event.clock.physicalTimeMs
}

export function dedupeEvidence<T extends { type: string }>(items: T[]): T[] {
  if (items.length < 2) {
    return items
  }

  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    let key = item.type
    if ("parentEventId" in item) {
      key = `${item.type}:${item.parentEventId}`
    } else if ("dependsOnEventId" in item) {
      key = `${item.type}:${item.dependsOnEventId}`
    }
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(item)
  }

  return result
}
