import type {
  EventAnomaly,
  EventEnvelope,
  LateArrivalPolicy,
  OrderBatch,
  StreamOrderOptions,
  ValidatedEventEnvelope,
  WatermarkFunction,
} from "../types.js"
import { detectAnomalies } from "../anomalies/detectAnomalies.js"
import { getValidatedEventTime } from "../internal/utils.js"
import { orderEvents } from "./orderEvents.js"
import { eventTimeWatermark } from "./watermarkStrategies.js"
import { validateEvent } from "../validate/validateEvent.js"

type BufferedEvent<T> = {
  event: ValidatedEventEnvelope<T>
  eventTime: bigint
}

const LATE_ARRIVAL_POLICIES: readonly LateArrivalPolicy[] = [
  "flag",
  "drop",
  "emit_correction",
  "fail",
]

function assertValidStreamOptions<T>(
  options: StreamOrderOptions<T> | undefined,
): void {
  if (options?.batchSize !== undefined) {
    if (
      !Number.isSafeInteger(options.batchSize) ||
      options.batchSize <= 0
    ) {
      throw new Error("Stream option batchSize must be a positive safe integer")
    }
  }

  if (options?.maxLateArrivalMs !== undefined) {
    if (
      typeof options.maxLateArrivalMs !== "bigint" ||
      options.maxLateArrivalMs < 0n
    ) {
      throw new Error("Stream option maxLateArrivalMs must be a non-negative bigint")
    }
  }

  if (
    options?.lateArrivalPolicy !== undefined &&
    !LATE_ARRIVAL_POLICIES.includes(options.lateArrivalPolicy)
  ) {
    throw new Error(`Unsupported lateArrivalPolicy: ${String(options.lateArrivalPolicy)}`)
  }

  if (
    options?.watermark !== undefined &&
    typeof options.watermark !== "function"
  ) {
    throw new Error("Stream option watermark must be a function")
  }
}

function getCurrentWatermark(
  maxObservedWatermarkSignal: bigint,
  maxLateArrivalMs: bigint,
): bigint {
  if (maxObservedWatermarkSignal <= maxLateArrivalMs) {
    return 0n
  }

  return maxObservedWatermarkSignal - maxLateArrivalMs
}

function resolveWatermarkSignal<T>(
  event: EventEnvelope<T>,
  getWatermark: WatermarkFunction<T>,
): bigint | undefined {
  const value = getWatermark(event)
  if (value === undefined) {
    return undefined
  }

  if (typeof value !== "bigint" || value < 0n) {
    throw new Error("Watermark strategy must return a non-negative bigint or undefined")
  }

  return value
}

export async function* orderEventStream<T>(
  source: AsyncIterable<EventEnvelope<T>>,
  options?: StreamOrderOptions<T>,
): AsyncIterable<OrderBatch<T>> {
  assertValidStreamOptions(options)

  const batchSize = options?.batchSize ?? 100
  const maxLateArrivalMs = options?.maxLateArrivalMs ?? 30_000n
  const lateArrivalPolicy = options?.lateArrivalPolicy ?? "flag"
  const getWatermark = options?.watermark ?? eventTimeWatermark
  const validationOptions: { maxClockDriftMs?: bigint } = {}
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }

  const buffer: BufferedEvent<T>[] = []
  let maxObservedWatermarkSignal = 0n
  let pendingAnomalies: EventAnomaly<T>[] = []
  let lastFlushedWatermark = -1n

  const flushReady = (
    flushAll: boolean,
    isTerminal: boolean,
  ): OrderBatch<T> | undefined => {
    const watermark = getCurrentWatermark(
      maxObservedWatermarkSignal,
      maxLateArrivalMs,
    )
    lastFlushedWatermark = watermark
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
    const validation = validateEvent(event, validationOptions)
    const previousWatermarkSignal = maxObservedWatermarkSignal
    const pendingAnomalyCountBefore = pendingAnomalies.length

    if (!validation.valid && (options?.strict ?? false)) {
      throw new Error(
        `Invalid event ${event.id || "<unknown>"}: ${validation.errors
          .map((error) => error.message)
          .join("; ")}`,
      )
    }

    if (!validation.valid) {
      pendingAnomalies.push(...detectAnomalies([event], {
        ...validationOptions,
        validations: [{ event, validation }],
      }))
    } else {
      const watermarkSignal = resolveWatermarkSignal(event, getWatermark)
      if (
        watermarkSignal !== undefined &&
        watermarkSignal > maxObservedWatermarkSignal
      ) {
        maxObservedWatermarkSignal = watermarkSignal
      }
    }

    const validatedEventTime = validation.valid
      ? getValidatedEventTime(validation.value)
      : undefined
    const currentWatermark = getCurrentWatermark(
      maxObservedWatermarkSignal,
      maxLateArrivalMs,
    )
    const isLate =
      validatedEventTime !== undefined &&
      validatedEventTime < currentWatermark

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
      const eventTime = validatedEventTime
      if (eventTime === undefined) {
        throw new Error("Validated event is missing event time")
      }

      buffer.push({
        event: validation.value,
        eventTime,
      })
    }

    const shouldForceCorrectionFlush =
      lateArrivalPolicy === "emit_correction" && isLate
    const watermarkAdvanced =
      maxObservedWatermarkSignal !== previousWatermarkSignal &&
      currentWatermark !== lastFlushedWatermark
    const hasNewPendingAnomalies =
      pendingAnomalies.length !== pendingAnomalyCountBefore
    const hasNewReadyEvent =
      validatedEventTime !== undefined &&
      validatedEventTime <= currentWatermark

    if (shouldForceCorrectionFlush) {
      const correctionBatch = flushReady(true, false)
      if (correctionBatch !== undefined) {
        yield correctionBatch
      }
    } else if (buffer.length >= batchSize) {
      const maybeBatch = flushReady(
        false,
        false,
      )
      if (maybeBatch !== undefined) {
        yield maybeBatch
      }
    } else if (
      watermarkAdvanced ||
      hasNewPendingAnomalies ||
      hasNewReadyEvent
    ) {
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
