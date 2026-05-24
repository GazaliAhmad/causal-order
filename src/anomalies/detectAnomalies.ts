import type {
  EventAnomaly,
  EventEnvelope,
  OrderOptions,
  ValidationResult,
  ValidatedEventEnvelope,
} from "../types.js"
import { createAnomalyCollector, pushSingleEventValidationAnomalies } from "./internalAnomalyCollector.js"
import { validateEvent } from "../validate/validateEvent.js"

type EventValidationRecord<T> = {
  event: EventEnvelope<T>
  validation: ValidationResult<ValidatedEventEnvelope<T>>
}

function* iterateValidationRecords<T>(
  events: EventEnvelope<T>[],
  validationOptions: { maxClockDriftMs?: bigint },
): Iterable<EventValidationRecord<T>> {
  for (const event of events) {
    yield {
      event,
      validation: validateEvent(event, validationOptions),
    }
  }
}

export function detectSingleEventAnomalies<T>(
  event: EventEnvelope<T>,
  validation: ValidationResult<ValidatedEventEnvelope<T>>,
): EventAnomaly<T>[] {
  const anomalies: EventAnomaly<T>[] = []
  pushSingleEventValidationAnomalies(anomalies, event, validation)
  return anomalies
}

export function detectAnomalies<T>(
  events: EventEnvelope<T>[],
  options?: Pick<OrderOptions<T>, "maxClockDriftMs"> & {
    validations?: EventValidationRecord<T>[]
  },
): EventAnomaly<T>[] {
  const collector = createAnomalyCollector<T>()
  const validationOptions: { maxClockDriftMs?: bigint } = {}
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }
  const validations = options?.validations ?? iterateValidationRecords(events, validationOptions)

  for (const { event, validation } of validations) {
    collector.observe(event, validation)
  }

  return collector.anomalies
}
