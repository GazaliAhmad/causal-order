# Causal Order Technical Specification

## Working Package Name

`causal-order`

Alternative names:

* `event-integrity`
* `logical-order`
* `hlc-order`

## Purpose

A TypeScript library for ordering, validating, and analyzing distributed events without assuming server clocks are trustworthy.

The library must:

* order what can be ordered
* group what is concurrent
* flag what is suspicious
* refuse false certainty

## Core Design Principle

Wall-clock time is metadata.

It is not proof of event order.

The library must keep these concepts separate:

* physical time
* logical time
* causal order
* deterministic fallback order
* civil-time grouping

## Normative Rules

These rules are core to the design and must be enforced consistently across the API surface.

### Confidence Rule

`proven` requires explicit causal evidence.
HLC-only ordering is always `derived`.

### Causality Comparison Rule

`concurrent` means valid metadata proves there is no known causal relationship.
`unknown` means the metadata is insufficient, malformed, invalid, or untrustworthy.

### Error Handling Rule

Batch APIs must return structured validation results by default.
Parser and constructor APIs may throw on malformed input.

### Streaming Finality Rule

Streaming finality is watermark-based and operational, not causal.
Late events must be flagged, corrected, dropped, or rejected according to explicit policy.

## Relationship to `day-boundary`

`day-boundary` should not be used inside the core ordering engine.

Event ordering is about causality. `day-boundary` is about civil-time grouping. Mixing them would make the mental model muddy.

Use `day-boundary` only as an optional companion dependency for:

* daily audit reports
* business-day log buckets
* incident timelines grouped by operational day
* compliance exports
* local calendar views

Do not use it to determine event order, causality, conflict detection, or clock validation.

Possible optional peer dependency:

```json
{
  "peerDependencies": {
    "day-boundary": "^1.0.0"
  },
  "peerDependenciesMeta": {
    "day-boundary": {
      "optional": true
    }
  }
}
```

Example optional import:

```ts
import { groupOrderedEventsByDay } from "causal-order/day-boundary"

const grouped = groupOrderedEventsByDay(orderedEvents, {
  timezone: "Asia/Singapore",
  boundaryHour: 4
})
```

## Core Types

```ts
export type NodeId = string
export type EventId = string

export type HlcTimestamp = {
  physicalTimeMs: bigint
  logicalCounter: number
  nodeId: NodeId
}

export type CausalOrdering =
  | "before"
  | "after"
  | "equal"
  | "concurrent"
  | "unknown"

export type CausalEvidence =
  | { type: "parent_event"; parentEventId: EventId }
  | { type: "trace_parent_child"; traceId: string }
  | { type: "causal_dependency"; dependsOnEventId: EventId }
  | { type: "message_receive"; relatedEventId?: EventId }
  | { type: "vector_dominance" }
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
```

`CausalEvidence` is the formal abstraction for machine-readable causal reasoning.
The library must not rely on implicit explanations for why an event was treated as causally proven.

## Clock API

```ts
export function createHlcClock(options: {
  nodeId: NodeId
  now?: () => bigint
  maxDriftMs?: bigint
}): HlcClock

export type HlcClock = {
  now(): HlcTimestamp
  receive(remote: HlcTimestamp): HlcTimestamp
  getState(): HlcTimestamp
}
```

Rules:

* `now()` must always move forward logically.
* `receive()` must merge local and remote clocks.
* local clock regression must increment the logical counter, not move backward.
* low-level clock operations may throw on malformed clock input.

## Comparison API

```ts
export function compareClocks(
  a: HlcTimestamp,
  b: HlcTimestamp
): CausalOrdering
```

Expected result:

```ts
compareClocks(a, b)
// "before" | "after" | "equal" | "concurrent" | "unknown"
```

Important distinction:

Hybrid Logical Clocks provide a useful ordering signal, but they do not always prove causality.

Therefore the library should expose separate comparison functions:

```ts
compareByHlc(a, b)
compareByCausality(a, b)
compareDeterministically(a, b)
```

The package must not hide these under one vague `compare()` function.

### `compareByCausality()` Semantics

This function needs a strict distinction between `concurrent` and `unknown`.

Return `concurrent` when:

* the metadata is sufficient to evaluate causal precedence
* neither event causally precedes the other

Example conditions:

* both clocks are valid
* different nodes
* no parent or dependency relationship
* no dominance relation
* no shared sequence domain

Meaning:

```txt
A and B are both valid, but no causal order exists.
```

Do not use `concurrent` as a polite word for "we don't know".

Return `unknown` when the evidence is insufficient or untrustworthy.

Examples:

* missing clock
* invalid clock
* missing `nodeId`
* untrusted metadata
* mixed timestamp formats
* partial event envelope
* malformed sequence

Rule:

```txt
concurrent = known independence
unknown = insufficient evidence
```

## Event Ordering API

### In-Memory Mode

```ts
export function orderEvents<T>(
  events: EventEnvelope<T>[],
  options?: OrderOptions<T>
): OrderResult<T>
```

### Streaming Mode

```ts
export async function* orderEventStream<T>(
  source: AsyncIterable<EventEnvelope<T>>,
  options?: StreamOrderOptions<T>
): AsyncIterable<StreamOrderBatch<T>>
```

## Error Handling Policy

Use both throwing and structured validation errors, but keep them at separate layers.

### Low-Level Parsers and Constructors

Low-level constructors and parsers should throw on malformed input.

Example:

```ts
parseHlc("bad-value")
```

Throwing is acceptable here because the caller explicitly asked to parse one invalid value.

This rule applies to APIs such as:

* `parseHlc()`
* low-level clock constructors
* low-level clock merge or receive operations when given malformed clock values

### Bulk Processing APIs

Bulk processing APIs should return structured errors by default rather than crashing on the first bad event.

Examples:

* `orderEvents(events)`
* `orderEventStream(source)`

These should not abort the entire analysis by default.

They should surface invalid records through anomalies or validation results, for example:

```ts
{
  ordered: [],
  anomalies: [
    { type: "invalid_clock", severity: "error" }
  ]
}
```

### Strict Mode

Add a strict mode:

```ts
strict: true
```

When `strict: true`, invalid inputs should throw or abort the stream.

Recommended default:

```ts
strict: false
```

Reason:

```txt
for millions of events, one malformed record should not destroy the whole analysis unless explicitly requested
```

## Order Result

```ts
export type OrderResult<T> = {
  ordered: OrderedEvent<T>[]
  concurrentGroups: EventEnvelope<T>[][]
  anomalies: EventAnomaly<T>[]
  stats: OrderStats
}
```

```ts
export type OrderedEvent<T> = {
  event: EventEnvelope<T>
  orderIndex: bigint
  orderBasis:
    | "causal"
    | "hlc"
    | "sequence"
    | "deterministic_tiebreaker"
    | "ingestion_order"
  confidence:
    | "proven"
    | "derived"
    | "fallback"
    | "unknown"
  causalEvidence?: CausalEvidence[]
}
```

If `confidence` is `"proven"`, the result should include at least one `causalEvidence` entry explaining why.
If `confidence` is `"derived"`, `causalEvidence` should be absent or empty unless the evidence was examined and found non-proving.

## Confidence Semantics

`confidence` must describe how strongly the library can justify the reported order.

### Proven

Use `confidence: "proven"` only when there is explicit evidence of causality.

Examples:

* `parentEventId`
* `traceId` with a parent-child span relationship
* explicit causal dependency list
* message send/receive relationship
* vector clock dominance
* same node + monotonic sequence

These cases justify a causal claim such as:

```txt
A caused B
```

This reasoning should be machine-readable through one or more `CausalEvidence` entries.

Example:

```ts
{
  orderBasis: "causal",
  confidence: "proven",
  causalEvidence: [
    { type: "parent_event", parentEventId: "evt-123" }
  ]
}
```

### Derived

Use `confidence: "derived"` when order is inferred from HLC, sequence, or ingestion metadata.

Example:

```txt
A.hlc < B.hlc
```

This means `A` can be ordered before `B` for processing, but it does not prove that `B` knew about `A` or depended on it.

Therefore HLC-only ordering should be reported as:

```ts
orderBasis: "hlc"
confidence: "derived"
```

not:

```ts
confidence: "proven"
```

Rule:

```txt
HLC can support deterministic temporal ordering. It does not, by itself, prove causality.
```

### Why This Matters

Users will eventually ask:

```txt
Why did confidence become "proven"?
```

The answer must be inspectable by tooling.
Without a formal causal evidence abstraction, anomaly investigation, debugging, and audit workflows become weak.

### Fallback

Use `confidence: "fallback"` when the library must rely on deterministic tie-breaking rather than causal evidence or a stronger inferred ordering signal.

### Unknown

Use `confidence: "unknown"` when no defensible order can be established.

## Options

```ts
export type OrderOptions<T> = {
  tieBreaker?: TieBreaker<T>
  strict?: boolean
  detectAnomalies?: boolean
  allowUnknownOrder?: boolean
  maxClockDriftMs?: bigint
  getPartition?: (event: EventEnvelope<T>) => string | undefined
}
```

```ts
export type TieBreaker<T> =
  | "node_id"
  | "event_id"
  | "sequence"
  | "ingestion_order"
  | ((a: EventEnvelope<T>, b: EventEnvelope<T>) => number)
```

Default tie-breaker:

```txt
clock → sequence → nodeId → eventId
```

The result must label tie-breaking as non-causal.

## Streaming Requirements

The streaming engine must support:

* millions of events
* bounded memory
* async iterables
* batch output
* windowed sorting
* watermarking
* late-arriving events

Suggested API:

```ts
export type StreamOrderOptions<T> = OrderOptions<T> & {
  batchSize?: number
  windowSizeMs?: bigint
  maxLateArrivalMs?: bigint
  lateArrivalPolicy?: LateArrivalPolicy
  watermark?: (event: EventEnvelope<T>) => bigint
}
```

```ts
export type LateArrivalPolicy =
  | "flag"
  | "drop"
  | "emit_correction"
  | "fail"
```

Output:

```ts
export type StreamOrderBatch<T> = {
  events: OrderedEvent<T>[]
  anomalies: EventAnomaly<T>[]
  watermark: bigint
  isFinal: boolean
}
```

### Streaming Policy

Default streaming behavior should be conservative, not magical.

The library must not silently drop or reorder late events.

Recommended defaults:

```ts
windowSizeMs: 60_000n
maxLateArrivalMs: 30_000n
lateArrivalPolicy: "flag"
```

Meaning of `lateArrivalPolicy: "flag"`:

* process the event
* mark it as late
* include an anomaly
* do not pretend the original output was perfectly final

Recommended policies:

* audit or compliance mode: `lateArrivalPolicy: "fail"`
* telemetry or log mode: `lateArrivalPolicy: "flag"`
* real-time dashboard mode: `lateArrivalPolicy: "emit_correction"`

### Watermark Semantics

Recommended default watermark policy:

```txt
watermark = maxSeenPhysicalTime - maxLateArrivalMs
```

This watermark represents processing confidence, not causal certainty.

It is a statement about how long the engine waited before treating output as stable enough to emit.
It is not proof that no earlier causal event exists.

`maxLateArrivalMs` should be understood the same way.

It defines the operational lateness window for stream handling.
It does not define whether explicit causal evidence is still `proven`.

So an event may still be causally older with explicit evidence and yet be treated as operationally late for the active stream window.
That distinction must stay visible to consumers.

### Memory Strategy

The streaming engine is expected to operate using bounded sliding windows rather than full historical graph retention.

This section is conceptual rather than fully prescriptive, but the implementation must be consistent with the bounded-memory requirement.

Expected strategies:

* evict events whose ordering window is closed by the current watermark
* prefer heap or priority-queue structures for candidate emission order rather than repeated full-window resorting
* keep only a bounded partial-order graph for unresolved dependencies inside the active window
* compact emitted batches so finalized events do not remain in memory
* buffer concurrent groups only while they are still unresolved within the active window
* apply backpressure rather than unbounded buffering when the consumer cannot keep up

Conceptual guidance:

* window eviction should be watermark-driven
* heap strategy should optimize incremental emission from the active window
* partial ordering graph limits should prevent indefinite retention of dependency edges
* batch compaction should release finalized events, indexes, and temporary graph state
* concurrent-group buffering should be limited to events still capable of reclassification within the late-arrival window
* backpressure behavior should surface operational pressure explicitly instead of hiding it behind unbounded memory growth

Non-goal:

```txt
the engine should not require full historical retention of all prior events in order to process an unbounded stream
```

## Anomaly Detection

```ts
export type EventAnomaly<T> = {
  type: AnomalyType
  severity: "info" | "warning" | "error" | "fatal"
  event?: EventEnvelope<T>
  relatedEvents?: EventEnvelope<T>[]
  message: string
}
```

```ts
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
```

Anomalies must never be silently corrected.

## Validation API

```ts
export function validateEvent<T>(
  event: EventEnvelope<T>
): ValidationResult
```

```ts
export type ValidationResult = {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}
```

Validation must check:

* valid `nodeId`
* valid `eventId`
* valid `physicalTimeMs`
* valid `logicalCounter`
* valid `sequence` if provided
* reasonable clock drift if configured

## Serialization Format

Compact string format:

```txt
<physicalTimeMs>:<logicalCounter>:<nodeId>
```

Example:

```txt
1714971840123:4:api-1
```

API:

```ts
export function serializeHlc(clock: HlcTimestamp): string

export function parseHlc(value: string): HlcTimestamp
```

Optional binary format can come later.

## Package Structure

```txt
src/
  clock/
    hlc.ts
    parse.ts
    serialize.ts

  compare/
    hlcCompare.ts
    causalCompare.ts
    deterministicCompare.ts

  order/
    orderEvents.ts
    orderEventStream.ts
    tieBreakers.ts

  validate/
    validateEvent.ts
    validateClock.ts

  anomalies/
    detectAnomalies.ts
    types.ts

  adapters/
    jsonl.ts

  integrations/
    dayBoundary.ts

  index.ts
```

## Non-Goals

The library must not become:

* a database
* a queue
* a Kafka wrapper
* a CRDT framework
* a consensus system
* a tracing platform
* a log collector

It is an event ordering and integrity layer.

## MVP Scope

### Version 0.1.0

* HLC generation
* HLC parsing and serialization
* event validation
* in-memory ordering
* basic anomaly detection
* deterministic tie-breaking
* TypeScript types

### Version 0.2.0

* streaming order engine
* late-arrival handling
* windowed sorting
* JSONL adapter

### Version 0.3.0

* `day-boundary` integration
* audit report helpers
* incident timeline grouping

## Documentation and Adoption Requirements

This library has strong ecosystem gravity.

It is:

* conceptually rigorous
* operationally valuable
* psychologically unfamiliar

Most engineers are trained to think:

```txt
timestamp = order
```

This library explicitly says:

```txt
sometimes order is unknowable
```

That is a paradigm shift.

Therefore documentation and examples are not secondary.
They are essential to adoption.

The project must explain, repeatedly and concretely, why naive timestamp sorting is unsafe in distributed systems.

Required example categories:

* replay corruption examples
* multi-region drift examples
* false audit timeline examples
* offline sync anomalies
* causal inversion demos

Documentation goal:

```txt
answer "why not just sort by timestamp?" before the user asks it
```

Without strong examples, the conceptual value of the library will be easy to miss and adoption will suffer.

## Positioning

Do not call this a time library.

Call it an event integrity library.

The value is not:

```txt
we implement HLC
```

The value is:

```txt
we stop your distributed event timeline from lying to you
```
