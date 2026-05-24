import type {
  EventEnvelope,
  EventId,
  HlcTimestamp,
  NodeId,
  TranslateBatchPolicy,
  TranslationDiagnostic,
  TranslationActualValueType,
  TranslatedEventEnvelope,
  TranslateBatchConfig,
  TranslateBatchResult,
  TranslationAnomalyCode,
  TranslateTimestampInput,
  TranslationAnomaly,
  TranslationField,
  TranslationFieldReference,
  TranslationMapperName,
  TranslationPolicyDecision,
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

type EventEnvelopeResolution<TInput, TPayload> =
  | {
    kind: "value"
    value: EventEnvelope<TPayload>
    anomalies: TranslationAnomaly<TInput>[]
  }
  | {
    kind: "rejected"
    anomalies: TranslationAnomaly<TInput>[]
    terminalAnomaly: TranslationAnomaly<TInput>
  }

type TimestampCoercionResult =
  | { kind: "value"; value: bigint }
  | { kind: "invalid"; message: string }

type NormalizedTranslateBatchPolicy = {
  recordFailure: "warn" | "fail"
  optionalFieldFailure: "warn" | "continue" | "fail"
}

export class TranslateBatchPolicyError<TInput = unknown> extends Error {
  readonly anomaly: TranslationAnomaly<TInput>

  constructor(anomaly: TranslationAnomaly<TInput>) {
    super(
      `translateBatch policy ${anomaly.policy.key} chose ${anomaly.policy.action} for ${anomaly.mapper} at record ${anomaly.index}`,
    )
    this.name = "TranslateBatchPolicyError"
    this.anomaly = anomaly
  }
}

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
  policy: TranslationPolicyDecision,
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
  const fieldReference: TranslationFieldReference = {
    kind: "ingress_field",
    field,
    mapper,
  }
  const classification = classifyTranslationAnomaly(code, stage)
  const ordering = {
    kind: "record_field_order" as const,
    sequence: -1,
    recordIndex: index,
    fieldOrder: TRANSLATION_FIELD_ORDER[field],
  }
  const diagnostic: TranslationDiagnostic<TInput> = {
    source: stage === "mapper" ? "mapping" : "structural",
    classification,
    policy,
    ordering,
    stage,
    record: {
      index,
      input,
    },
    location: {
      field,
      mapper,
      fieldReference,
    },
    contract: {
      expected,
      ...(actualType !== undefined ? { actualType } : {}),
      ...(actualValue !== undefined ? { actualValue } : {}),
    },
  }

  return {
    code,
    message,
    index,
    input,
    field,
    mapper,
    fieldReference,
    classification,
    policy,
    ordering,
    stage,
    expected,
    ...(actualType !== undefined ? { actualType } : {}),
    ...(actualValue !== undefined ? { actualValue } : {}),
    diagnostic,
  }
}

function classifyTranslationAnomaly(
  code: TranslationAnomalyCode,
  stage: TranslationAnomaly["stage"],
): TranslationAnomaly["classification"] {
  return {
    domain: "translation",
    family: stage === "mapper" ? "mapping" : "structural",
    category:
      code === "missing_required_value"
        ? "required_value_missing"
        : code === "mapper_exception"
          ? "mapper_failure"
          : "invalid_value",
    code,
  }
}

function finalizeTranslationAnomalyOrdering<TInput>(
  anomaly: TranslationAnomaly<TInput>,
  sequence: number,
): TranslationAnomaly<TInput> {
  anomaly.ordering.sequence = sequence
  anomaly.diagnostic.ordering.sequence = sequence
  return anomaly
}

function normalizeTranslateBatchPolicy(
  policy: TranslateBatchPolicy | undefined,
): NormalizedTranslateBatchPolicy {
  return {
    recordFailure: policy?.recordFailure ?? "warn",
    optionalFieldFailure: policy?.optionalFieldFailure ?? "warn",
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
  policy: TranslationPolicyDecision,
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
        policy,
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
  policy: TranslationPolicyDecision,
  mapper: (record: TInput, index: number) => TValue,
  isValid: (value: unknown) => value is TValue,
  missingMessage: string,
  invalidMessage: string,
  expected: string,
): ValueOrAnomaly<TInput, TValue> {
  const mapped = readMapperValue(input, index, field, mapperName, policy, mapper)
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
        policy,
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
        policy,
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
  policy: TranslationPolicyDecision,
  mapper: ((record: TInput, index: number) => TValue | undefined) | undefined,
  isValid: (value: unknown) => value is TValue,
  invalidMessage: string,
  expected: string,
): FieldResolution<TInput, TValue> {
  if (mapper === undefined) {
    return { kind: "omitted" }
  }

  const mapped = readMapperValue(input, index, field, mapperName, policy, mapper)
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
        policy,
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

const TRANSLATION_FIELD_ORDER: Record<TranslationField, number> = {
  event_id: 0,
  node_id: 1,
  physical_time: 2,
  logical_counter: 3,
  sequence: 4,
  parent_event_id: 5,
  dependency_event_ids: 6,
  trace_id: 7,
  partition: 8,
  ingested_at: 9,
  payload: 10,
}

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
  policy: TranslationPolicyDecision,
  mapper: ((record: TInput, index: number) => TPayload) | undefined,
): ValueOrAnomaly<TInput, TPayload> {
  if (mapper === undefined) {
    return {
      kind: "value",
      value: input as unknown as TPayload,
    }
  }

  const mapped = readMapperValue(input, index, "payload", "getPayload", policy, mapper)
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
  policy: TranslationPolicyDecision,
  mapper: (record: TInput, index: number) => TranslateTimestampInput,
  missingMessage: string,
  invalidMessage: string,
  expected: string,
): ValueOrAnomaly<TInput, bigint> {
  const mapped = readMapperValue(input, index, field, mapperName, policy, mapper)
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
        policy,
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
        policy,
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
  policy: TranslationPolicyDecision,
  mapper: ((record: TInput, index: number) => TranslateTimestampInput | undefined) | undefined,
  invalidMessage: string,
  expected: string,
): FieldResolution<TInput, bigint> {
  if (mapper === undefined) {
    return { kind: "omitted" }
  }

  const mapped = readMapperValue(input, index, field, mapperName, policy, mapper)
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
        policy,
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
  policy: NormalizedTranslateBatchPolicy,
): EventEnvelopeResolution<TInput, TPayload> {
  const anomalies: TranslationAnomaly<TInput>[] = []
  function rejectWith(
    anomaly: TranslationAnomaly<TInput>,
  ): EventEnvelopeResolution<TInput, TPayload> {
    return {
      kind: "rejected",
      anomalies: [...anomalies, anomaly],
      terminalAnomaly: anomaly,
    }
  }
  const recordFailurePolicy: TranslationPolicyDecision = {
    key: "record_failure",
    action: policy.recordFailure,
  }
  const optionalFieldPolicy: TranslationPolicyDecision = {
    key: "optional_field_failure",
    action: policy.optionalFieldFailure,
  }
  const id = resolveRequiredField(
    record,
    index,
    "event_id",
    "getEventId",
    recordFailurePolicy,
    config.getEventId,
    isEventId,
    "getEventId must return a value",
    "getEventId must return a non-empty string",
    "non-empty string",
  )
  if (id.kind === "anomaly") {
    return rejectWith(id.anomaly)
  }

  const nodeId = resolveRequiredField(
    record,
    index,
    "node_id",
    "getNodeId",
    recordFailurePolicy,
    config.getNodeId,
    isNodeId,
    "getNodeId must return a value",
    "getNodeId must return a non-empty string",
    "non-empty string",
  )
  if (nodeId.kind === "anomaly") {
    return rejectWith(nodeId.anomaly)
  }

  const physicalTimeMs = resolveRequiredTimestampField(
    record,
    index,
    "physical_time",
    "getPhysicalTime",
    recordFailurePolicy,
    config.getPhysicalTime,
    "getPhysicalTime must return a value",
    "getPhysicalTime must return a bigint, safe integer number, or canonical integer string epoch milliseconds",
    "bigint, safe integer number, or canonical integer string epoch milliseconds",
  )
  if (physicalTimeMs.kind === "anomaly") {
    return rejectWith(physicalTimeMs.anomaly)
  }

  const logicalCounter = resolveOptionalField(
    record,
    index,
    "logical_counter",
    "getLogicalCounter",
    optionalFieldPolicy,
    config.getLogicalCounter,
    isNonNegativeSafeInteger,
    "getLogicalCounter must return a non-negative safe integer or undefined",
    "non-negative safe integer or undefined",
  )
  if (logicalCounter.kind === "anomaly") {
    if (logicalCounter.anomaly.policy.action !== "continue") {
      return rejectWith(logicalCounter.anomaly)
    }
    anomalies.push(logicalCounter.anomaly)
  }

  const sequence = resolveOptionalField(
    record,
    index,
    "sequence",
    "getSequence",
    optionalFieldPolicy,
    config.getSequence,
    isNonNegativeBigInt,
    "getSequence must return a non-negative bigint or undefined",
    "non-negative bigint or undefined",
  )
  if (sequence.kind === "anomaly") {
    if (sequence.anomaly.policy.action !== "continue") {
      return rejectWith(sequence.anomaly)
    }
    anomalies.push(sequence.anomaly)
  }

  const parentEventId = resolveOptionalField(
    record,
    index,
    "parent_event_id",
    "getParentEventId",
    optionalFieldPolicy,
    config.getParentEventId,
    isEventId,
    "getParentEventId must return a non-empty string or undefined",
    "non-empty string or undefined",
  )
  if (parentEventId.kind === "anomaly") {
    if (parentEventId.anomaly.policy.action !== "continue") {
      return rejectWith(parentEventId.anomaly)
    }
    anomalies.push(parentEventId.anomaly)
  }

  const dependencyEventIds = resolveOptionalField(
    record,
    index,
    "dependency_event_ids",
    "getDependencyEventIds",
    optionalFieldPolicy,
    config.getDependencyEventIds,
    isEventIdArray,
    "getDependencyEventIds must return an array of non-empty strings or undefined",
    "array of non-empty strings or undefined",
  )
  if (dependencyEventIds.kind === "anomaly") {
    if (dependencyEventIds.anomaly.policy.action !== "continue") {
      return rejectWith(dependencyEventIds.anomaly)
    }
    anomalies.push(dependencyEventIds.anomaly)
  }

  const traceId = resolveOptionalField(
    record,
    index,
    "trace_id",
    "getTraceId",
    optionalFieldPolicy,
    config.getTraceId,
    isMetadataString,
    "getTraceId must return a non-empty string or undefined",
    "non-empty string or undefined",
  )
  if (traceId.kind === "anomaly") {
    if (traceId.anomaly.policy.action !== "continue") {
      return rejectWith(traceId.anomaly)
    }
    anomalies.push(traceId.anomaly)
  }

  const partition = resolveOptionalField(
    record,
    index,
    "partition",
    "getPartition",
    optionalFieldPolicy,
    config.getPartition,
    isMetadataString,
    "getPartition must return a non-empty string or undefined",
    "non-empty string or undefined",
  )
  if (partition.kind === "anomaly") {
    if (partition.anomaly.policy.action !== "continue") {
      return rejectWith(partition.anomaly)
    }
    anomalies.push(partition.anomaly)
  }

  const coercedIngestedAt = resolveOptionalTimestampField(
    record,
    index,
    "ingested_at",
    "getIngestedAt",
    optionalFieldPolicy,
    config.getIngestedAt,
    "getIngestedAt must return a bigint, safe integer number, or canonical integer string epoch milliseconds, or undefined",
    "bigint, safe integer number, or canonical integer string epoch milliseconds, or undefined",
  )
  if (coercedIngestedAt.kind === "anomaly") {
    if (coercedIngestedAt.anomaly.policy.action !== "continue") {
      return rejectWith(coercedIngestedAt.anomaly)
    }
    anomalies.push(coercedIngestedAt.anomaly)
  }

  const payload = resolvePayload(record, index, recordFailurePolicy, config.getPayload)
  if (payload.kind === "anomaly") {
    return rejectWith(payload.anomaly)
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
    anomalies,
  }
}

export function translateBatch<TInput, TPayload = TInput>(
  records: readonly TInput[],
  config: TranslateBatchConfig<TInput, TPayload>,
): TranslateBatchResult<TPayload, TInput> {
  const translated: TranslatedEventEnvelope<TPayload>[] = []
  const anomalies: TranslationAnomaly<TInput>[] = []
  const policy = normalizeTranslateBatchPolicy(config.policy)
  let anomalySequence = 0

  for (const [index, record] of records.entries()) {
    const event = createEventEnvelope(record, index, config, policy)
    if (event.kind === "rejected") {
      for (const anomaly of event.anomalies) {
        finalizeTranslationAnomalyOrdering(anomaly, anomalySequence)
        anomalySequence += 1
      }

      if (event.terminalAnomaly.policy.action === "fail") {
        throw new TranslateBatchPolicyError(event.terminalAnomaly)
      }

      anomalies.push(...event.anomalies)
      continue
    }

    for (const anomaly of event.anomalies) {
      finalizeTranslationAnomalyOrdering(anomaly, anomalySequence)
      anomalySequence += 1
    }

    anomalies.push(...event.anomalies)
    translated.push(toTranslatedEnvelope(event.value))
  }

  return {
    translated,
    anomalies,
  }
}
