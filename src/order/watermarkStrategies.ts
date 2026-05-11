import type { EventEnvelope, WatermarkFunction } from "../types.js"

function getClockPhysicalTime<T>(
  event: EventEnvelope<T>,
): bigint | undefined {
  const clock = event.clock
  if (
    typeof clock !== "object" ||
    clock === null ||
    typeof clock.physicalTimeMs !== "bigint" ||
    clock.physicalTimeMs < 0n
  ) {
    return undefined
  }

  return clock.physicalTimeMs
}

export function eventTimeWatermark<T>(
  event: EventEnvelope<T>,
): bigint | undefined {
  return getClockPhysicalTime(event)
}

export function ingestedAtWatermark<T>(
  event: EventEnvelope<T>,
): bigint | undefined {
  if (typeof event.ingestedAt === "bigint" && event.ingestedAt >= 0n) {
    return event.ingestedAt
  }

  return eventTimeWatermark(event)
}

export function createProcessingTimeWatermark<T>(
  options?: {
    now?: () => bigint
    floorToEventTime?: boolean
  },
): WatermarkFunction<T> {
  const now = options?.now ?? (() => BigInt(Date.now()))
  const floorToEventTime = options?.floorToEventTime ?? false

  return (event) => {
    const observedTime = (
      typeof event.ingestedAt === "bigint" && event.ingestedAt >= 0n
    )
      ? event.ingestedAt
      : now()
    if (!floorToEventTime) {
      return observedTime
    }

    const eventTime = eventTimeWatermark(event)
    if (eventTime !== undefined && observedTime < eventTime) {
      return eventTime
    }

    return observedTime
  }
}
