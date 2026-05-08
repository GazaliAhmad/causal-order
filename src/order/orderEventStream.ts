import type {
  EventAnomaly,
  EventEnvelope,
  OrderBatch,
  StreamOrderOptions,
  ValidatedEventEnvelope,
} from "../types.js"
import { detectAnomalies } from "../anomalies/detectAnomalies.js"
import { getEventTime, getValidatedEventTime } from "../internal/utils.js"
import { orderEvents } from "./orderEvents.js"
import { validateEvent } from "../validate/validateEvent.js"

type BufferedEvent<T> = {
  event: ValidatedEventEnvelope<T>
  eventTime: bigint
}

function defaultWatermark<T>(
  event: EventEnvelope<T>,
): bigint {
  return getEventTime(event) ?? 0n
}

export async function* orderEventStream<T>(
  source: AsyncIterable<EventEnvelope<T>>,
  options?: StreamOrderOptions<T>,
): AsyncIterable<OrderBatch<T>> {
  const batchSize = options?.batchSize ?? 100
  const maxLateArrivalMs = options?.maxLateArrivalMs ?? 30_000n
  const lateArrivalPolicy = options?.lateArrivalPolicy ?? "flag"
  const getWatermark = options?.watermark ?? defaultWatermark

  const buffer: BufferedEvent<T>[] = []
  let maxSeenPhysicalTime = 0n
  let pendingAnomalies: EventAnomaly<T>[] = []

  const flushReady = (
    flushAll: boolean,
    isTerminal: boolean,
  ): OrderBatch<T> | undefined => {
    const watermark = maxSeenPhysicalTime - maxLateArrivalMs
    const ready: ValidatedEventEnvelope<T>[] = []
    let writeIndex = 0

    for (let readIndex = 0; readIndex < buffer.length; readIndex += 1) {
      const entry = buffer[readIndex]
      if (entry === undefined) {
        continue
      }

      if (flushAll || entry.eventTime <= watermark) {
        ready.push(entry.event)
        continue
      }

      buffer[writeIndex] = entry
      writeIndex += 1
    }

    buffer.length = writeIndex

    if (ready.length === 0 && pendingAnomalies.length === 0 && !isTerminal) {
      return undefined
    }

    const result = ready.length > 0
      ? orderEvents(ready, options)
      : {
          ordered: [],
          anomalies: [],
        }
    const anomalies = result.anomalies.length > 0
      ? [...result.anomalies, ...pendingAnomalies]
      : pendingAnomalies
    pendingAnomalies = []

    return {
      events: result.ordered,
      anomalies,
      watermark,
      isFinal: isTerminal && buffer.length === 0,
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

    if (!validation.valid) {
      pendingAnomalies.push(...detectAnomalies([event], validationOptions))
    }

    const watermarkValue = getWatermark(event)
    if (watermarkValue > maxSeenPhysicalTime) {
      maxSeenPhysicalTime = watermarkValue
    }

    const currentWatermark = maxSeenPhysicalTime - maxLateArrivalMs
    const validatedEventTime = validation.valid
      ? getValidatedEventTime(validation.value)
      : undefined
    const eventTime = validatedEventTime ?? getEventTime(event)
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
        const maybeBatch = flushReady(false, false)
        if (maybeBatch !== undefined) {
          yield maybeBatch
        }
        continue
      }
    }

    if (validation.valid) {
      buffer.push({
        event: validation.value,
        eventTime: getValidatedEventTime(validation.value),
      })
    }

    if (buffer.length >= batchSize) {
      const maybeBatch = flushReady(
        lateArrivalPolicy === "emit_correction" && isLate,
        false,
      )
      if (maybeBatch !== undefined) {
        yield maybeBatch
      }
    } else {
      const maybeBatch = flushReady(false, false)
      if (maybeBatch !== undefined) {
        yield maybeBatch
      }
    }
  }

  const finalBatch = flushReady(true, true)
  if (finalBatch !== undefined) {
    yield finalBatch
  }
}
