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
  concurrentGroupCount: number
  anomalyCount: number
}

export type OrderResult<T = unknown> = {
  ordered: OrderedEvent<T>[]
  concurrentGroups: EventEnvelope<T>[][]
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

export type LateArrivalPolicy =
  | "flag"
  | "drop"
  | "emit_correction"
  | "fail"

export type StreamOrderOptions<T> = OrderOptions<T> & {
  batchSize?: number
  maxLateArrivalMs?: bigint
  lateArrivalPolicy?: LateArrivalPolicy
  watermark?: (event: EventEnvelope<T>) => bigint
}

export type OrderBatch<T = unknown> = {
  events: OrderedEvent<T>[]
  anomalies: EventAnomaly<T>[]
  watermark: bigint
  isFinal: boolean
}
