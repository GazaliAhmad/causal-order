import type { EventEnvelope, ValidationResult } from "../types.js"
import { isBigInt, isNonEmptyString } from "../internal/utils.js"
import { validateClock } from "./validateClock.js"

export function validateEvent<T>(
  event: EventEnvelope<T>,
  options?: { maxClockDriftMs?: bigint; now?: () => bigint },
): ValidationResult {
  const errors: ValidationResult["errors"] = []
  const warnings: ValidationResult["warnings"] = []

  if (!isNonEmptyString(event?.id)) {
    errors.push({
      code: "missing_event_id",
      message: "event.id must be a non-empty string",
      path: "id",
    })
  }

  if (!isNonEmptyString(event?.nodeId)) {
    errors.push({
      code: "missing_node_id",
      message: "event.nodeId must be a non-empty string",
      path: "nodeId",
    })
  }

  const clockOptions: { maxDriftMs?: bigint; now?: () => bigint } = {}
  if (options?.maxClockDriftMs !== undefined) {
    clockOptions.maxDriftMs = options.maxClockDriftMs
  }
  if (options?.now !== undefined) {
    clockOptions.now = options.now
  }

  const clockValidation = validateClock(event.clock, clockOptions)
  errors.push(...clockValidation.errors)
  warnings.push(...clockValidation.warnings)

  if (event.sequence !== undefined && (!isBigInt(event.sequence) || event.sequence < 0n)) {
    errors.push({
      code: "invalid_sequence",
      message: "event.sequence must be a non-negative bigint when provided",
      path: "sequence",
    })
  }

  if (event.sequence === undefined) {
    warnings.push({
      code: "missing_sequence",
      message: "event.sequence is not present",
      path: "sequence",
    })
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
