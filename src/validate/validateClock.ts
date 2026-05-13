import type {
  HlcTimestamp,
  ValidationError,
  ValidationResult,
  ValidationWarning,
  ValidatedHlcTimestamp,
} from "../types.js"
import { isBigInt, isNonEmptyString, isSafeInteger } from "../internal/utils.js"

export function validateClock(
  clock: HlcTimestamp,
  options?: { maxDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean },
): ValidationResult<ValidatedHlcTimestamp>
export function validateClock(
  clock: unknown,
  options?: { maxDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean },
): ValidationResult<ValidatedHlcTimestamp>
export function validateClock(
  clock: unknown,
  options?: { maxDriftMs?: bigint; now?: () => bigint; includeWarnings?: boolean },
): ValidationResult<ValidatedHlcTimestamp> {
  const errors: ValidationError[] = []
  const warnings: ValidationWarning[] = []

  if (typeof clock !== "object" || clock === null) {
    errors.push({
      code: "invalid_clock",
      message: "Clock must be an object",
      path: "clock",
    })
    return { valid: false, errors, warnings }
  }

  const candidate = clock as Partial<HlcTimestamp>
  const physicalTimeMs = candidate.physicalTimeMs
  const currentTime = options?.now?.()

  if (!isBigInt(physicalTimeMs) || physicalTimeMs < 0n) {
    errors.push({
      code: "invalid_physical_time",
      message: "clock.physicalTimeMs must be a non-negative bigint",
      path: "clock.physicalTimeMs",
    })
  }

  if (!isSafeInteger(candidate.logicalCounter) || candidate.logicalCounter < 0) {
    errors.push({
      code: "invalid_logical_counter",
      message: "clock.logicalCounter must be a non-negative safe integer",
      path: "clock.logicalCounter",
    })
  }

  if (!isNonEmptyString(candidate.nodeId)) {
    errors.push({
      code: "missing_node_id",
      message: "clock.nodeId must be a non-empty string",
      path: "clock.nodeId",
    })
  }

  if (
    currentTime !== undefined &&
    options?.maxDriftMs !== undefined &&
    isBigInt(physicalTimeMs) &&
    physicalTimeMs > currentTime + options.maxDriftMs
  ) {
    errors.push({
      code: "clock_drift_exceeded",
      message: "clock.physicalTimeMs exceeds configured max drift",
      path: "clock.physicalTimeMs",
    })
  }

  if (
    options?.includeWarnings !== false &&
    currentTime !== undefined &&
    isBigInt(physicalTimeMs) &&
    physicalTimeMs > currentTime
  ) {
    warnings.push({
      code: "future_timestamp",
      message: "clock.physicalTimeMs is in the future relative to the validator clock",
      path: "clock.physicalTimeMs",
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
    value: candidate as ValidatedHlcTimestamp,
  }
}
