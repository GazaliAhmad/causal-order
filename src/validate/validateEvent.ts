import type {
  EventEnvelope,
  ValidationError,
  ValidationResult,
  ValidationWarning,
  ValidatedEventEnvelope,
} from "../types.js"
import { isBigInt, isNonEmptyString } from "../internal/utils.js"
import { validateClock } from "./validateClock.js"

export function validateEvent<T>(
  event: EventEnvelope<T>,
  options?: { maxClockDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean },
): ValidationResult<ValidatedEventEnvelope<T>>
export function validateEvent(
  event: unknown,
  options?: { maxClockDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean },
): ValidationResult<ValidatedEventEnvelope<unknown>>
export function validateEvent<T>(
  event: unknown,
  options?: { maxClockDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean },
): ValidationResult<ValidatedEventEnvelope<T>> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []
  const candidate = typeof event === "object" && event !== null
    ? event as Partial<EventEnvelope<T>>
    : undefined

  if (!isNonEmptyString(candidate?.id)) {
    errors.push({
      code: "missing_event_id",
      message: "event.id must be a non-empty string",
      path: "id",
    })
  }

  if (!isNonEmptyString(candidate?.nodeId)) {
    errors.push({
      code: "missing_node_id",
      message: "event.nodeId must be a non-empty string",
      path: "nodeId",
    })
  }

  const clockOptions: { maxDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean } = {}
  if (options?.maxClockDriftMs !== undefined) {
    clockOptions.maxDriftMs = options.maxClockDriftMs
  }
  if (options?.now !== undefined) {
    clockOptions.now = options.now
  }
  if (options?.includeWarnings !== undefined) {
    clockOptions.includeWarnings = options.includeWarnings
  }

  const clockValidation = validateClock(candidate?.clock, clockOptions)
  errors.push(...clockValidation.errors)
  warnings.push(...clockValidation.warnings)

  if (
    candidate?.sequence !== undefined &&
    (!isBigInt(candidate.sequence) || candidate.sequence < 0n)
  ) {
    errors.push({
      code: "invalid_sequence",
      message: "event.sequence must be a non-negative bigint when provided",
      path: "sequence",
    })
  }

  if (options?.includeWarnings !== false && candidate?.sequence === undefined) {
    warnings.push({
      code: "missing_sequence",
      message: "event.sequence is not present",
      path: "sequence",
    })
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
    }
  }

  return {
    valid: true,
    errors: [],
    warnings,
    value: candidate as ValidatedEventEnvelope<T>,
  }
}
