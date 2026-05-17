import type {
  CorrectionNotice,
  EventAnomaly,
  EventEnvelope,
  LateArrivalPolicy,
  OrderBatch,
  StreamOrderOptions,
  ValidationResult,
  ValidatedEventEnvelope,
  WatermarkFunction,
} from "../types.js"
import { detectAnomalies } from "../anomalies/detectAnomalies.js"
import { getValidatedEventTime } from "../internal/utils.js"
import { orderValidatedEvents } from "./orderEvents.js"
import { eventTimeWatermark } from "./watermarkStrategies.js"
import { validateEvent } from "../validate/validateEvent.js"

type BufferedEvent<T> = {
  event: ValidatedEventEnvelope<T>
  eventTime: bigint
  validation: ValidationResult<ValidatedEventEnvelope<T>>
}

const STREAM_ANOMALY_HORIZON = {
  retainedEventHistory: "buffered_window_only",
  crossWindowRelationalDetection: "late_arrival_only",
} as const

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

function getActiveWatermark(
  maxObservedWatermarkSignal: bigint,
  maxLateArrivalMs: bigint,
): bigint {
  if (maxObservedWatermarkSignal <= maxLateArrivalMs) {
    return 0n
  }

  return maxObservedWatermarkSignal - maxLateArrivalMs
}

function isEventReadyForWatermark(
  eventTime: bigint,
  watermark: bigint,
): boolean {
  return eventTime <= watermark
}

function isEventLateForWatermark(
  eventTime: bigint,
  watermark: bigint,
): boolean {
  return eventTime < watermark
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
    throw new Error(
      "Watermark function must return a non-negative bigint stream-progress signal or undefined",
    )
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
  const validationOptions: { maxClockDriftMs?: bigint; includeWarnings?: boolean } = {
    includeWarnings: false,
  }
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }

  const readyBuffer: BufferedEvent<T>[] = []
  const pendingBuffer: BufferedEvent<T>[] = []
  let maxObservedWatermarkSignal = 0n
  let pendingAnomalies: EventAnomaly<T>[] = []
  let lastFlushedWatermark = -1n
  let lastPendingPromotionWatermark = -1n

  const getBufferedEventCount = (): number =>
    readyBuffer.length + pendingBuffer.length

  const promotePendingEntriesForWatermark = (
    flushAll: boolean,
    watermark: bigint,
  ): void => {
    if (pendingBuffer.length === 0) {
      return
    }

    if (flushAll) {
      for (const entry of pendingBuffer) {
        readyBuffer.push(entry)
      }
      pendingBuffer.length = 0
      lastPendingPromotionWatermark = watermark
      return
    }

    if (watermark === lastPendingPromotionWatermark) {
      return
    }

    let writeIndex = 0
    for (let readIndex = 0; readIndex < pendingBuffer.length; readIndex += 1) {
      const entry = pendingBuffer[readIndex]
      if (entry === undefined) {
        continue
      }

      if (isEventReadyForWatermark(entry.eventTime, watermark)) {
        readyBuffer.push(entry)
        continue
      }

      pendingBuffer[writeIndex] = entry
      writeIndex += 1
    }

    pendingBuffer.length = writeIndex
    lastPendingPromotionWatermark = watermark
  }

  const flushReady = (
    flushAll: boolean,
    isTerminal: boolean,
    correction?: CorrectionNotice,
  ): OrderBatch<T> | undefined => {
    const watermark = getActiveWatermark(
      maxObservedWatermarkSignal,
      maxLateArrivalMs,
    )
    lastFlushedWatermark = watermark
    promotePendingEntriesForWatermark(flushAll, watermark)
    const ready: ValidatedEventEnvelope<T>[] = []
    const readyValidations: Array<{
      event: ValidatedEventEnvelope<T>
      validation: ValidationResult<ValidatedEventEnvelope<T>>
    }> = []

    for (let index = 0; index < readyBuffer.length; index += 1) {
      const entry = readyBuffer[index]
      if (entry === undefined) {
        continue
      }

      ready.push(entry.event)
      readyValidations.push({
        event: entry.event,
        validation: entry.validation,
      })
    }

    readyBuffer.length = 0

    if (ready.length === 0 && pendingAnomalies.length === 0 && !isTerminal) {
      return undefined
    }

    const result = ready.length > 0
      ? orderValidatedEvents(ready, options, {
          sourceEvents: ready,
          validations: readyValidations,
        })
      : {
          ordered: [],
          anomalies: [],
        }
    const anomalies = result.anomalies.length > 0
      ? [...result.anomalies, ...pendingAnomalies]
      : pendingAnomalies
    pendingAnomalies = []

    const batch: OrderBatch<T> = {
      events: result.ordered,
      anomalies,
      watermark,
      anomalyHorizon: STREAM_ANOMALY_HORIZON,
      isFinal: isTerminal && getBufferedEventCount() === 0,
    }

    if (correction !== undefined) {
      batch.correction = correction
    }

    return batch
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
    const currentWatermark = getActiveWatermark(
      maxObservedWatermarkSignal,
      maxLateArrivalMs,
    )
    const isLate =
      validatedEventTime !== undefined &&
      isEventLateForWatermark(validatedEventTime, currentWatermark)

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

      const entry: BufferedEvent<T> = {
        event: validation.value,
        eventTime,
        validation,
      }
      if (isEventReadyForWatermark(eventTime, currentWatermark)) {
        readyBuffer.push(entry)
      } else {
        pendingBuffer.push(entry)
      }
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
      isEventReadyForWatermark(validatedEventTime, currentWatermark)

    if (shouldForceCorrectionFlush) {
      const correctionBatch = flushReady(true, false, {
        reason: "late_arrival",
        scope: "all_non_final_output",
        triggerEventId: event.id,
      })
      if (correctionBatch !== undefined) {
        yield correctionBatch
      }
    } else if (getBufferedEventCount() >= batchSize) {
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
