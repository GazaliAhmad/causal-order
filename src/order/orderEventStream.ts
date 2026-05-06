import type {
  EventAnomaly,
  EventEnvelope,
  OrderBatch,
  StreamOrderOptions,
} from "../types.js"
import { getEventTime } from "../internal/utils.js"
import { orderEvents } from "./orderEvents.js"
import { validateEvent } from "../validate/validateEvent.js"

function defaultWatermark<T>(
  event: EventEnvelope<T>,
): bigint {
  return event.clock.physicalTimeMs
}

export async function* orderEventStream<T>(
  source: AsyncIterable<EventEnvelope<T>>,
  options?: StreamOrderOptions<T>,
): AsyncIterable<OrderBatch<T>> {
  const batchSize = options?.batchSize ?? 100
  const maxLateArrivalMs = options?.maxLateArrivalMs ?? 30_000n
  const lateArrivalPolicy = options?.lateArrivalPolicy ?? "flag"
  const getWatermark = options?.watermark ?? defaultWatermark

  const buffer: EventEnvelope<T>[] = []
  let maxSeenPhysicalTime = 0n
  let pendingAnomalies: EventAnomaly<T>[] = []

  const flushReady = (isFinal: boolean): OrderBatch<T> | undefined => {
    const watermark = maxSeenPhysicalTime - maxLateArrivalMs
    const ready: EventEnvelope<T>[] = []
    const remaining: EventEnvelope<T>[] = []

    for (const event of buffer) {
      const eventTime = getEventTime(event)
      if (isFinal || (eventTime !== undefined && eventTime <= watermark)) {
        ready.push(event)
      } else {
        remaining.push(event)
      }
    }

    buffer.length = 0
    buffer.push(...remaining)

    if (ready.length === 0 && pendingAnomalies.length === 0 && !isFinal) {
      return undefined
    }

    const result = orderEvents(ready, options)
    const anomalies = [...result.anomalies, ...pendingAnomalies]
    pendingAnomalies = []

    return {
      events: result.ordered,
      anomalies,
      watermark,
      isFinal: isFinal && buffer.length === 0,
    }
  }

  for await (const event of source) {
    const validationOptions: { maxClockDriftMs?: bigint } = {}
    if (options?.maxClockDriftMs !== undefined) {
      validationOptions.maxClockDriftMs = options.maxClockDriftMs
    }

    const validation = validateEvent(event, validationOptions)

    if (!validation.valid && (options?.strict ?? false)) {
      throw new Error(
        `Invalid event ${event.id || "<unknown>"}: ${validation.errors
          .map((error) => error.message)
          .join("; ")}`,
      )
    }

    const watermarkValue = getWatermark(event)
    if (watermarkValue > maxSeenPhysicalTime) {
      maxSeenPhysicalTime = watermarkValue
    }

    const currentWatermark = maxSeenPhysicalTime - maxLateArrivalMs
    const eventTime = getEventTime(event)
    const isLate = eventTime !== undefined && eventTime < currentWatermark

    if (isLate) {
      const anomaly: EventAnomaly<T> = {
        type: "late_arrival",
        severity: lateArrivalPolicy === "fail" ? "fatal" : "warning",
        event,
        message: "Event arrived after the active watermark",
      }

      if (lateArrivalPolicy === "fail") {
        throw new Error(`Late arrival rejected for event ${event.id}`)
      }

      pendingAnomalies.push(anomaly)

      if (lateArrivalPolicy === "drop") {
        const maybeBatch = flushReady(false)
        if (maybeBatch !== undefined) {
          yield maybeBatch
        }
        continue
      }
    }

    if (validation.valid) {
      buffer.push(event)
    }

    if (buffer.length >= batchSize) {
      const maybeBatch = flushReady(lateArrivalPolicy === "emit_correction" && isLate)
      if (maybeBatch !== undefined) {
        yield maybeBatch
      }
    } else {
      const maybeBatch = flushReady(false)
      if (maybeBatch !== undefined) {
        yield maybeBatch
      }
    }
  }

  const finalBatch = flushReady(true)
  if (finalBatch !== undefined) {
    yield finalBatch
  }
}
