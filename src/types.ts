export type NodeId = string
export type EventId = string

export type HlcTimestamp = {
  physicalTimeMs: bigint
  logicalCounter: number
  nodeId: NodeId
}

declare const validatedHlcTimestampBrand: unique symbol
export type ValidatedHlcTimestamp = HlcTimestamp & {
  readonly [validatedHlcTimestampBrand]: true
}

export type CausalOrdering =
  | "before"
  | "after"
  | "equal"
  | "unknown"

export type CausalEvidence =
  | { type: "parent_event"; parentEventId: EventId }
  | { type: "causal_dependency"; dependsOnEventId: EventId }
  | { type: "same_node_sequence" }

export type EventEnvelope<T = unknown> = {
  id: EventId
  nodeId: NodeId
  clock: HlcTimestamp
  payload: T
  sequence?: bigint
  partition?: string
  parentEventId?: EventId
  traceId?: string
  dependencyEventIds?: EventId[]
  ingestedAt?: bigint
}

export type TranslatedEventEnvelope<T = unknown> = {
  readonly id: EventId
  readonly nodeId: NodeId
  readonly clock: Readonly<HlcTimestamp>
  readonly payload: T
  readonly sequence?: bigint
  readonly partition?: string
  readonly parentEventId?: EventId
  readonly traceId?: string
  readonly dependencyEventIds?: readonly EventId[]
  readonly ingestedAt?: bigint
}

export type TranslateMapper<TInput, TValue> = (
  record: TInput,
  index: number,
) => TValue

export type TranslateTimestampInput =
  | bigint
  | number
  | string
  | Date

export type TranslateBatchConfig<TInput, TPayload = TInput> = {
  getEventId: TranslateMapper<TInput, EventId>
  getNodeId: TranslateMapper<TInput, NodeId>
  getPhysicalTime: TranslateMapper<TInput, TranslateTimestampInput>
  getLogicalCounter?: TranslateMapper<TInput, number | undefined>
  getSequence?: TranslateMapper<TInput, bigint | undefined>
  getParentEventId?: TranslateMapper<TInput, EventId | undefined>
  getDependencyEventIds?: TranslateMapper<TInput, readonly EventId[] | undefined>
  getTraceId?: TranslateMapper<TInput, string | undefined>
  getPartition?: TranslateMapper<TInput, string | undefined>
  getIngestedAt?: TranslateMapper<TInput, TranslateTimestampInput | undefined>
  getPayload?: TranslateMapper<TInput, TPayload>
}

export type TranslationAnomalyCode =
  | "missing_required_value"
  | "invalid_mapped_value"
  | "mapper_exception"

export type TranslationField =
  | "event_id"
  | "node_id"
  | "physical_time"
  | "logical_counter"
  | "sequence"
  | "parent_event_id"
  | "dependency_event_ids"
  | "trace_id"
  | "partition"
  | "ingested_at"
  | "payload"

export type TranslationMapperName =
  | "getEventId"
  | "getNodeId"
  | "getPhysicalTime"
  | "getLogicalCounter"
  | "getSequence"
  | "getParentEventId"
  | "getDependencyEventIds"
  | "getTraceId"
  | "getPartition"
  | "getIngestedAt"
  | "getPayload"

export type TranslationAnomalyStage =
  | "mapper"
  | "field_validation"
  | "timestamp_coercion"

export type TranslationActualValueType =
  | "undefined"
  | "null"
  | "bigint"
  | "number"
  | "string"
  | "boolean"
  | "symbol"
  | "function"
  | "date"
  | "array"
  | "object"

export type TranslationAnomaly<TInput = unknown> = {
  code: TranslationAnomalyCode
  message: string
  index: number
  input: TInput
  field: TranslationField
  mapper: TranslationMapperName
  stage: TranslationAnomalyStage
  expected: string
  actualType?: TranslationActualValueType
  actualValue?: unknown
}

export type TranslateBatchResult<TPayload = unknown, TInput = unknown> = {
  translated: readonly TranslatedEventEnvelope<TPayload>[]
  anomalies: readonly TranslationAnomaly<TInput>[]
}

declare const validatedEventEnvelopeBrand: unique symbol
export type ValidatedEventEnvelope<T = unknown> = EventEnvelope<T> & {
  readonly [validatedEventEnvelopeBrand]: true
}

export type ValidationErrorCode =
  | "missing_node_id"
  | "missing_event_id"
  | "invalid_clock"
  | "invalid_physical_time"
  | "invalid_logical_counter"
  | "invalid_sequence"
  | "clock_drift_exceeded"

export type ValidationWarningCode =
  | "missing_sequence"
  | "future_timestamp"

export type ValidationError = {
  code: ValidationErrorCode
  message: string
  path?: string
}

export type ValidationWarning = {
  code: ValidationWarningCode
  message: string
  path?: string
}

export type ValidationSuccess<TValue> = {
  valid: true
  errors: []
  warnings: ValidationWarning[]
  value: TValue
}

export type ValidationFailure = {
  valid: false
  errors: ValidationError[]
  warnings: ValidationWarning[]
  value?: never
}

export type ValidationResult<TValue = never> =
  | ValidationSuccess<TValue>
  | ValidationFailure

export type AnomalyType =
  | "clock_regression"
  | "future_timestamp"
  | "duplicate_event"
  | "missing_sequence"
  | "sequence_regression"
  | "same_node_sequence_conflict"
  | "causal_inversion"
  | "invalid_clock"
  | "unknown_order"
  | "late_arrival"

export type EventAnomaly<T = unknown> = {
  type: AnomalyType
  severity: "info" | "warning" | "error" | "fatal"
  event?: EventEnvelope<T>
  relatedEvents?: EventEnvelope<T>[]
  message: string
}

export type OrderedEvent<T = unknown> = {
  event: EventEnvelope<T>
  orderIndex: bigint
  orderBasis:
    | "causal"
    | "hlc"
    | "sequence"
    | "deterministic_tiebreaker"
    | "ingestion_order"
  confidence: "proven" | "derived" | "fallback" | "unknown"
  causalEvidence?: CausalEvidence[]
}

export type OrderStats = {
  totalEvents: number
  validEvents: number
  invalidEvents: number
  orderedEvents: number
  anomalyCount: number
}

export type OrderResult<T = unknown> = {
  ordered: OrderedEvent<T>[]
  anomalies: EventAnomaly<T>[]
  stats: OrderStats
}

export type TieBreaker<T> =
  | "node_id"
  | "event_id"
  | "sequence"
  | "ingestion_order"
  | ((a: EventEnvelope<T>, b: EventEnvelope<T>) => number)

export type OrderOptions<T> = {
  tieBreaker?: TieBreaker<T>
  strict?: boolean
  detectAnomalies?: boolean
  allowUnknownOrder?: boolean
  maxClockDriftMs?: bigint
}

export type CorrectionScope = "all_non_final_output"

export type CorrectionNotice = {
  /**
   * Why this batch should be treated as reconciliation-capable follow-up
   * rather than ordinary in-window output.
   */
  reason: "late_arrival"
  /**
   * In the current streaming contract, correction reach is policy-based rather
   * than watermark-bounded: any previously emitted non-final output in the
   * same stream instance may need reconciliation.
   */
  scope: CorrectionScope
  /**
   * The late event that triggered the correction-capable batch.
   */
  triggerEventId: EventId
}

export type StreamAnomalyHorizon = {
  /**
   * Previously emitted events are not retained for later relational anomaly
   * comparisons. Only the currently buffered window participates in
   * duplicate/sequence/causal cross-event checks.
   */
  retainedEventHistory: "buffered_window_only"
  /**
   * Once earlier windows have been emitted, the only relational stream-wide
   * anomaly still tracked is operational `late_arrival` against the active
   * watermark.
   */
  crossWindowRelationalDetection: "late_arrival_only"
}

export type LateArrivalPolicy =
  | "flag"
  | "drop"
  | "emit_correction"
  | "fail"

/**
 * A monotonic stream-progress signal observed while processing an event.
 * `orderEventStream()` converts the largest observed signal into the active
 * stream watermark by subtracting `maxLateArrivalMs`.
 */
export type WatermarkSignal = bigint

/**
 * Returns the stream-progress signal contributed by an event. This is not
 * necessarily the final emitted `batch.watermark`.
 */
export type WatermarkFunction<T> = (
  event: EventEnvelope<T>,
) => WatermarkSignal | undefined

export type StreamOrderOptions<T> = OrderOptions<T> & {
  batchSize?: number
  maxLateArrivalMs?: bigint
  lateArrivalPolicy?: LateArrivalPolicy
  /**
   * Supplies the stream-progress signal used to advance the active watermark.
   * The active `batch.watermark` is derived from the largest observed signal
   * minus `maxLateArrivalMs`.
   */
  watermark?: WatermarkFunction<T>
}

export type OrderBatch<T = unknown> = {
  events: OrderedEvent<T>[]
  anomalies: EventAnomaly<T>[]
  /**
   * The active operational watermark after applying `maxLateArrivalMs` to the
   * largest observed stream-progress signal.
   *
   * Events with `eventTime <= watermark` are ready to flush.
   * Events with `eventTime < watermark` are late.
   */
  watermark: bigint
  /**
   * Describes what anomaly history this stream instance still retains after
   * earlier windows have been emitted.
   */
  anomalyHorizon: StreamAnomalyHorizon
  /**
   * Present when the batch is a correction-capable follow-up triggered by a
   * late arrival under `lateArrivalPolicy: "emit_correction"`.
   */
  correction?: CorrectionNotice
  isFinal: boolean
}
