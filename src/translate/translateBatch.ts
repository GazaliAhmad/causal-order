import type {
  EventEnvelope,
  EventId,
  HlcTimestamp,
  NodeId,
  TranslationActualValueType,
  TranslatedEventEnvelope,
  TranslateBatchConfig,
  TranslateBatchResult,
  TranslationAnomalyCode,
  TranslateTimestampInput,
  TranslationAnomaly,
  TranslationField,
  TranslationMapperName,
} from "../types.js"
import { isBigInt, isNonEmptyString, isSafeInteger } from "../internal/utils.js"

type MapperReadResult<TInput, TValue> =
  | { ok: true; value: TValue }
  | { ok: false; anomaly: TranslationAnomaly<TInput> }

type FieldResolution<TInput, TValue> =
  | { kind: "value"; value: TValue }
  | { kind: "omitted" }
  | { kind: "anomaly"; anomaly: TranslationAnomaly<TInput> }

type ValueOrAnomaly<TInput, TValue> =
  | { kind: "value"; value: TValue }
  | { kind: "anomaly"; anomaly: TranslationAnomaly<TInput> }

type TimestampCoercionResult =
  | { kind: "value"; value: bigint }
  | { kind: "invalid"; message: string }

function toTranslatedClock(nodeId: string, physicalTimeMs: bigint, logicalCounter: number): Readonly<HlcTimestamp> {
  return Object.freeze({
    physicalTimeMs,
    logicalCounter,
    nodeId,
  })
}

function toTranslatedEnvelope<TPayload>(
  event: EventEnvelope<TPayload>,
): TranslatedEventEnvelope<TPayload> {
  const translated = {
    id: event.id,
    nodeId: event.nodeId,
    clock: toTranslatedClock(
      event.clock.nodeId,
      event.clock.physicalTimeMs,
      event.clock.logicalCounter,
    ),
    payload: event.payload,
    ...(event.sequence !== undefined ? { sequence: event.sequence } : {}),
    ...(event.partition !== undefined ? { partition: event.partition } : {}),
    ...(event.parentEventId !== undefined ? { parentEventId: event.parentEventId } : {}),
    ...(event.traceId !== undefined ? { traceId: event.traceId } : {}),
    ...(event.dependencyEventIds !== undefined
      ? { dependencyEventIds: Object.freeze([...event.dependencyEventIds]) }
      : {}),
    ...(event.ingestedAt !== undefined ? { ingestedAt: event.ingestedAt } : {}),
  }

  return Object.freeze(translated)
}

function createTranslationAnomaly<TInput>(
  input: TInput,
  index: number,
  field: TranslationField,
  mapper: TranslationMapperName,
  stage: TranslationAnomaly["stage"],
  code: TranslationAnomalyCode,
  message: string,
  expected: string,
  actualValue?: unknown,
  includeActualValue = false,
): TranslationAnomaly<TInput> {
  const actualType = !includeActualValue && actualValue === undefined
    ? undefined
    : getTranslationActualValueType(actualValue)

  return {
    code,
    message,
    index,
    input,
    field,
    mapper,
    stage,
    expected,
    ...(actualType !== undefined ? { actualType } : {}),
    ...(actualValue !== undefined ? { actualValue } : {}),
  }
}

function getTranslationActualValueType(value: unknown): TranslationActualValueType {
  if (value === undefined) {
    return "undefined"
  }
  if (value === null) {
    return "null"
  }
  if (value instanceof Date) {
    return "date"
  }
  if (Array.isArray(value)) {
    return "array"
  }

  switch (typeof value) {
    case "bigint":
      return "bigint"
    case "number":
      return "number"
    case "string":
      return "string"
    case "boolean":
      return "boolean"
    case "symbol":
      return "symbol"
    case "function":
      return "function"
    default:
      return "object"
  }
}

function readMapperValue<TInput, TValue>(
  input: TInput,
  index: number,
  field: TranslationField,
  mapperName: TranslationMapperName,
  mapper: (record: TInput, index: number) => TValue,
): MapperReadResult<TInput, TValue> {
  try {
    return {
      ok: true,
      value: mapper(input, index),
    }
  } catch (error) {
    return {
      ok: false,
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "mapper",
        "mapper_exception",
        error instanceof Error
          ? error.message
          : `Mapper for ${field} threw while translating a record`,
        `${mapperName} must return a value without throwing`,
      ),
    }
  }
}

function resolveRequiredField<TInput, TValue>(
  input: TInput,
  index: number,
  field: TranslationField,
  mapperName: TranslationMapperName,
  mapper: (record: TInput, index: number) => TValue,
  isValid: (value: unknown) => value is TValue,
  missingMessage: string,
  invalidMessage: string,
  expected: string,
): ValueOrAnomaly<TInput, TValue> {
  const mapped = readMapperValue(input, index, field, mapperName, mapper)
  if (!mapped.ok) {
    return { kind: "anomaly", anomaly: mapped.anomaly }
  }

  if (mapped.value === undefined) {
    return {
      kind: "anomaly",
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "mapper",
        "missing_required_value",
        missingMessage,
        expected,
        mapped.value,
        true,
      ),
    }
  }

  if (!isValid(mapped.value)) {
    return {
      kind: "anomaly",
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "field_validation",
        "invalid_mapped_value",
        invalidMessage,
        expected,
        mapped.value,
      ),
    }
  }

  return {
    kind: "value",
    value: mapped.value,
  }
}

function resolveOptionalField<TInput, TValue>(
  input: TInput,
  index: number,
  field: TranslationField,
  mapperName: TranslationMapperName,
  mapper: ((record: TInput, index: number) => TValue | undefined) | undefined,
  isValid: (value: unknown) => value is TValue,
  invalidMessage: string,
  expected: string,
): FieldResolution<TInput, TValue> {
  if (mapper === undefined) {
    return { kind: "omitted" }
  }

  const mapped = readMapperValue(input, index, field, mapperName, mapper)
  if (!mapped.ok) {
    return { kind: "anomaly", anomaly: mapped.anomaly }
  }

  if (mapped.value === undefined) {
    return { kind: "omitted" }
  }

  if (!isValid(mapped.value)) {
    return {
      kind: "anomaly",
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "field_validation",
        "invalid_mapped_value",
        invalidMessage,
        expected,
        mapped.value,
      ),
    }
  }

  return {
    kind: "value",
    value: mapped.value,
  }
}

function isNonNegativeBigInt(value: unknown): value is bigint {
  return isBigInt(value) && value >= 0n
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0
}

const CANONICAL_INTEGER_STRING_PATTERN = /^-?(0|[1-9]\d*)$/

function isEventIdArray(value: unknown): value is readonly EventId[] {
  if (!Array.isArray(value)) {
    return false
  }

  for (let index = 0; index < value.length; index += 1) {
    if (!isNonEmptyString(value[index])) {
      return false
    }
  }

  return true
}

function resolvePayload<TInput, TPayload>(
  input: TInput,
  index: number,
  mapper: ((record: TInput, index: number) => TPayload) | undefined,
): ValueOrAnomaly<TInput, TPayload> {
  if (mapper === undefined) {
    return {
      kind: "value",
      value: input as unknown as TPayload,
    }
  }

  const mapped = readMapperValue(input, index, "payload", "getPayload", mapper)
  if (!mapped.ok) {
    return { kind: "anomaly", anomaly: mapped.anomaly }
  }

  return {
    kind: "value",
    value: mapped.value,
  }
}

function resolveValue<TInput, TValue>(
  result: FieldResolution<TInput, TValue>,
): TValue | undefined {
  return result.kind === "value" ? result.value : undefined
}

function isEventId(value: unknown): value is EventId {
  return isNonEmptyString(value)
}

function isNodeId(value: unknown): value is NodeId {
  return isNonEmptyString(value)
}

function isMetadataString(value: unknown): value is string {
  return isNonEmptyString(value)
}

function coerceTimestampInput(
  value: TranslateTimestampInput,
  invalidMessage: string,
): TimestampCoercionResult {
  if (isBigInt(value)) {
    return {
      kind: "value",
      value: value,
    }
  }

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      return {
        kind: "invalid",
        message: invalidMessage,
      }
    }

    return {
      kind: "value",
      value: BigInt(value),
    }
  }

  if (typeof value === "string") {
    if (!CANONICAL_INTEGER_STRING_PATTERN.test(value)) {
      return {
        kind: "invalid",
        message: invalidMessage,
      }
    }

    return {
      kind: "value",
      value: BigInt(value),
    }
  }

  if (value instanceof Date) {
    return {
      kind: "invalid",
      message: "Date values are not supported; use bigint, safe integer number, or canonical integer string epoch milliseconds",
    }
  }

  return {
    kind: "invalid",
    message: invalidMessage,
  }
}

function resolveRequiredTimestampField<TInput>(
  input: TInput,
  index: number,
  field: TranslationField,
  mapperName: TranslationMapperName,
  mapper: (record: TInput, index: number) => TranslateTimestampInput,
  missingMessage: string,
  invalidMessage: string,
  expected: string,
): ValueOrAnomaly<TInput, bigint> {
  const mapped = readMapperValue(input, index, field, mapperName, mapper)
  if (!mapped.ok) {
    return { kind: "anomaly", anomaly: mapped.anomaly }
  }

  if (mapped.value === undefined) {
    return {
      kind: "anomaly",
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "mapper",
        "missing_required_value",
        missingMessage,
        expected,
        mapped.value,
        true,
      ),
    }
  }

  const coerced = coerceTimestampInput(mapped.value, invalidMessage)
  if (coerced.kind === "invalid") {
    return {
      kind: "anomaly",
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "timestamp_coercion",
        "invalid_mapped_value",
        coerced.message,
        expected,
        mapped.value,
      ),
    }
  }

  return {
    kind: "value",
    value: coerced.value,
  }
}

function resolveOptionalTimestampField<TInput>(
  input: TInput,
  index: number,
  field: TranslationField,
  mapperName: TranslationMapperName,
  mapper: ((record: TInput, index: number) => TranslateTimestampInput | undefined) | undefined,
  invalidMessage: string,
  expected: string,
): FieldResolution<TInput, bigint> {
  if (mapper === undefined) {
    return { kind: "omitted" }
  }

  const mapped = readMapperValue(input, index, field, mapperName, mapper)
  if (!mapped.ok) {
    return { kind: "anomaly", anomaly: mapped.anomaly }
  }

  if (mapped.value === undefined) {
    return { kind: "omitted" }
  }

  const coerced = coerceTimestampInput(mapped.value, invalidMessage)
  if (coerced.kind === "invalid") {
    return {
      kind: "anomaly",
      anomaly: createTranslationAnomaly(
        input,
        index,
        field,
        mapperName,
        "timestamp_coercion",
        "invalid_mapped_value",
        coerced.message,
        expected,
        mapped.value,
      ),
    }
  }

  return {
    kind: "value",
    value: coerced.value,
  }
}

function createEventEnvelope<TInput, TPayload>(
  record: TInput,
  index: number,
  config: TranslateBatchConfig<TInput, TPayload>,
): ValueOrAnomaly<TInput, EventEnvelope<TPayload>> {
  const id = resolveRequiredField(
    record,
    index,
    "event_id",
    "getEventId",
    config.getEventId,
    isEventId,
    "getEventId must return a value",
    "getEventId must return a non-empty string",
    "non-empty string",
  )
  if (id.kind === "anomaly") {
    return id
  }

  const nodeId = resolveRequiredField(
    record,
    index,
    "node_id",
    "getNodeId",
    config.getNodeId,
    isNodeId,
    "getNodeId must return a value",
    "getNodeId must return a non-empty string",
    "non-empty string",
  )
  if (nodeId.kind === "anomaly") {
    return nodeId
  }

  const physicalTimeMs = resolveRequiredTimestampField(
    record,
    index,
    "physical_time",
    "getPhysicalTime",
    config.getPhysicalTime,
    "getPhysicalTime must return a value",
    "getPhysicalTime must return a bigint, safe integer number, or canonical integer string epoch milliseconds",
    "bigint, safe integer number, or canonical integer string epoch milliseconds",
  )
  if (physicalTimeMs.kind === "anomaly") {
    return physicalTimeMs
  }

  const logicalCounter = resolveOptionalField(
    record,
    index,
    "logical_counter",
    "getLogicalCounter",
    config.getLogicalCounter,
    isNonNegativeSafeInteger,
    "getLogicalCounter must return a non-negative safe integer or undefined",
    "non-negative safe integer or undefined",
  )
  if (logicalCounter.kind === "anomaly") {
    return logicalCounter
  }

  const sequence = resolveOptionalField(
    record,
    index,
    "sequence",
    "getSequence",
    config.getSequence,
    isNonNegativeBigInt,
    "getSequence must return a non-negative bigint or undefined",
    "non-negative bigint or undefined",
  )
  if (sequence.kind === "anomaly") {
    return sequence
  }

  const parentEventId = resolveOptionalField(
    record,
    index,
    "parent_event_id",
    "getParentEventId",
    config.getParentEventId,
    isEventId,
    "getParentEventId must return a non-empty string or undefined",
    "non-empty string or undefined",
  )
  if (parentEventId.kind === "anomaly") {
    return parentEventId
  }

  const dependencyEventIds = resolveOptionalField(
    record,
    index,
    "dependency_event_ids",
    "getDependencyEventIds",
    config.getDependencyEventIds,
    isEventIdArray,
    "getDependencyEventIds must return an array of non-empty strings or undefined",
    "array of non-empty strings or undefined",
  )
  if (dependencyEventIds.kind === "anomaly") {
    return dependencyEventIds
  }

  const traceId = resolveOptionalField(
    record,
    index,
    "trace_id",
    "getTraceId",
    config.getTraceId,
    isMetadataString,
    "getTraceId must return a non-empty string or undefined",
    "non-empty string or undefined",
  )
  if (traceId.kind === "anomaly") {
    return traceId
  }

  const partition = resolveOptionalField(
    record,
    index,
    "partition",
    "getPartition",
    config.getPartition,
    isMetadataString,
    "getPartition must return a non-empty string or undefined",
    "non-empty string or undefined",
  )
  if (partition.kind === "anomaly") {
    return partition
  }

  const coercedIngestedAt = resolveOptionalTimestampField(
    record,
    index,
    "ingested_at",
    "getIngestedAt",
    config.getIngestedAt,
    "getIngestedAt must return a bigint, safe integer number, or canonical integer string epoch milliseconds, or undefined",
    "bigint, safe integer number, or canonical integer string epoch milliseconds, or undefined",
  )
  if (coercedIngestedAt.kind === "anomaly") {
    return coercedIngestedAt
  }

  const payload = resolvePayload(record, index, config.getPayload)
  if (payload.kind === "anomaly") {
    return payload
  }

  const event: EventEnvelope<TPayload> = {
    id: id.value,
    nodeId: nodeId.value,
    clock: {
      physicalTimeMs: physicalTimeMs.value,
      logicalCounter: resolveValue(logicalCounter) ?? 0,
      nodeId: nodeId.value,
    },
    payload: payload.value,
  }

  const resolvedSequence = resolveValue(sequence)
  if (resolvedSequence !== undefined) {
    event.sequence = resolvedSequence
  }

  const resolvedParentEventId = resolveValue(parentEventId)
  if (resolvedParentEventId !== undefined) {
    event.parentEventId = resolvedParentEventId
  }

  const resolvedDependencyEventIds = resolveValue(dependencyEventIds)
  if (resolvedDependencyEventIds !== undefined) {
    event.dependencyEventIds = [...resolvedDependencyEventIds]
  }

  const resolvedTraceId = resolveValue(traceId)
  if (resolvedTraceId !== undefined) {
    event.traceId = resolvedTraceId
  }

  const resolvedPartition = resolveValue(partition)
  if (resolvedPartition !== undefined) {
    event.partition = resolvedPartition
  }

  const resolvedIngestedAt = resolveValue(coercedIngestedAt)
  if (resolvedIngestedAt !== undefined) {
    event.ingestedAt = resolvedIngestedAt
  }

  return {
    kind: "value",
    value: event,
  }
}

export function translateBatch<TInput, TPayload = TInput>(
  records: readonly TInput[],
  config: TranslateBatchConfig<TInput, TPayload>,
): TranslateBatchResult<TPayload, TInput> {
  const translated: TranslatedEventEnvelope<TPayload>[] = []
  const anomalies: TranslationAnomaly<TInput>[] = []

  for (const [index, record] of records.entries()) {
    const event = createEventEnvelope(record, index, config)
    if (event.kind === "anomaly") {
      anomalies.push(event.anomaly)
      continue
    }

    translated.push(toTranslatedEnvelope(event.value))
  }

  return {
    translated,
    anomalies,
  }
}
