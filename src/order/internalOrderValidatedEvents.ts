import type {
  EventAnomaly,
  EventEnvelope,
  ValidatedEventEnvelope,
  ValidationResult,
} from "../types.js"

export type EventValidationRecord<T> = {
  event: EventEnvelope<T>
  validation: ValidationResult<ValidatedEventEnvelope<T>>
}

/**
 * Internal coordination helper for `orderValidatedEvents()`.
 *
 * This type is intentionally kept off the public package export surface so the
 * extra parameter can be narrowed or removed before `1.0.0` without pretending
 * it is a long-term domain contract.
 */
export type OrderValidatedEventsInternalOptions<T> = {
  sourceEvents?: EventEnvelope<T>[]
  validations?: EventValidationRecord<T>[]
  anomalies?: EventAnomaly<T>[]
  invalidEvents?: number
}
