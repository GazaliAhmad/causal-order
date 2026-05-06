import type { HlcTimestamp, ValidationResult } from "../types.js"
import { isBigInt, isNonEmptyString, isSafeInteger } from "../internal/utils.js"

export function validateClock(
  clock: HlcTimestamp,
  options?: { maxDriftMs?: bigint; now?: () => bigint },
): ValidationResult {
  const errors: ValidationResult["errors"] = []
  const warnings: ValidationResult["warnings"] = []

  if (typeof clock !== "object" || clock === null) {
    errors.push({
      code: "invalid_clock",
      message: "Clock must be an object",
      path: "clock",
    })
    return { valid: false, errors, warnings }
  }

  if (!isBigInt(clock.physicalTimeMs) || clock.physicalTimeMs < 0n) {
    errors.push({
      code: "invalid_physical_time",
      message: "clock.physicalTimeMs must be a non-negative bigint",
      path: "clock.physicalTimeMs",
    })
  }

  if (!isSafeInteger(clock.logicalCounter) || clock.logicalCounter < 0) {
    errors.push({
      code: "invalid_logical_counter",
      message: "clock.logicalCounter must be a non-negative safe integer",
      path: "clock.logicalCounter",
    })
  }

  if (!isNonEmptyString(clock.nodeId)) {
    errors.push({
      code: "missing_node_id",
      message: "clock.nodeId must be a non-empty string",
      path: "clock.nodeId",
    })
  }

  const now = options?.now
  if (
    now !== undefined &&
    options?.maxDriftMs !== undefined &&
    isBigInt(clock.physicalTimeMs) &&
    clock.physicalTimeMs > now() + options.maxDriftMs
  ) {
    errors.push({
      code: "clock_drift_exceeded",
      message: "clock.physicalTimeMs exceeds configured max drift",
      path: "clock.physicalTimeMs",
    })
  }

  if (
    now !== undefined &&
    isBigInt(clock.physicalTimeMs) &&
    clock.physicalTimeMs > now()
  ) {
    warnings.push({
      code: "future_timestamp",
      message: "clock.physicalTimeMs is in the future relative to the validator clock",
      path: "clock.physicalTimeMs",
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
