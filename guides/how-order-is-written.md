# How Order Is Written

This guide explains what actually gets written into ordered output for the four confidence states:

* `proven`
* `derived`
* `fallback`
* `unknown`

It covers both:

* batch ordering with `orderEvents()`
* streaming ordering with `orderEventStream()`

## The Important Distinction

There are two different ideas that are easy to mix together:

* pairwise relationship: what the library can say about `A` versus `B`
* emitted ordered entry: what metadata is attached to each written output row

That distinction matters most for `unknown`.

If `compareByCausality(A, B)` returns `unknown`, that does not automatically mean
the emitted ordered rows will have `confidence: "unknown"`.

In many normal cases, the library still writes both events in a deterministic order,
but marks them as `derived` or `fallback` rather than `proven`.

`confidence: "unknown"` in emitted ordered output is the stronger warning case:
the ordering graph could not be fully resolved, so the runtime appended the event
deterministically in non-strict mode.

## Quick Reference

| Case | What it means | Batch output | Stream output |
| --- | --- | --- | --- |
| `proven` `A -> B` | explicit causal evidence puts `B` after `A` | written in causal order; the causally constrained event carries `confidence: "proven"` | same behavior, but only for the ready window being flushed |
| `derived` `B -> A` | the runtime infers `B` before `A` from usable metadata, not proof | written in inferred order with `confidence: "derived"` | same behavior inside the current flushed window |
| `fallback` `A || B` | no strong evidence, but the output still needs a stable deterministic order | written in deterministic order with `confidence: "fallback"` | same behavior inside the current flushed window |
| `unknown` `A ? B` | the library cannot safely justify a pairwise causal claim | often still written, usually as `derived` or `fallback`; only unresolved graph cases emit `confidence: "unknown"` | same, but late-arrival policy can affect when the event is emitted |

## `proven`: `A -> B`

This is the strongest case.

The library has explicit supported evidence such as:

* `parentEventId`
* `dependencyEventIds`
* same-node monotonic `sequence`

In batch mode, this means the relevant edge is enforced before writing output.
If `B` depends on `A`, then `B` is written after `A`.

Typical emitted shape:

```ts
const result = orderEvents([B, A])

result.ordered
// [
//   {
//     event: A,
//     orderIndex: 0n,
//     orderBasis: "sequence" | "hlc" | "causal",
//     confidence: "derived" | "proven",
//   },
//   {
//     event: B,
//     orderIndex: 1n,
//     orderBasis: "causal" | "sequence",
//     confidence: "proven",
//     causalEvidence: [
//       { type: "parent_event", parentEventId: "A" }
//     ],
//   },
// ]
```

The important part is not that every row becomes `proven`.
The important part is that the event whose placement is backed by explicit evidence
is emitted with `confidence: "proven"` and stays after its required predecessor.

In stream mode, the same rule applies inside the current ready window:

```ts
for await (const batch of orderEventStream(source())) {
  batch.events
}
```

If both `A` and `B` are in the flushed window, `B` is still written after `A`
with the same `proven` semantics.

If `B` arrives late relative to the watermark, the causal truth does not change.
The stream still treats `A -> B` as proven, but emission timing is now also subject
to `lateArrivalPolicy`.

## `derived`: `B -> A`

This means the runtime can place `B` before `A` for output, but not as a causal proof.

Typical reasons:

* `B.clock.physicalTimeMs < A.clock.physicalTimeMs`
* a configured tie-breaker such as `ingestion_order`
* sequence presence that helps placement without stronger explicit causal evidence

In batch mode, the library writes the inferred order:

```ts
const result = orderEvents([A, B])

result.ordered
// [
//   {
//     event: B,
//     orderIndex: 0n,
//     orderBasis: "hlc" | "sequence" | "ingestion_order",
//     confidence: "derived",
//   },
//   {
//     event: A,
//     orderIndex: 1n,
//     orderBasis: "hlc" | "sequence" | "ingestion_order",
//     confidence: "derived",
//   },
// ]
```

This is not last-write-wins.
It is deterministic inferred ordering.

In stream mode, the same thing happens for the events that are ready to flush now:

```ts
for await (const batch of orderEventStream(source())) {
  batch.events
  batch.watermark
  batch.isFinal
}
```

If `B` and `A` are both ready in the same flushed window, the stream writes `B`
before `A` with `confidence: "derived"`.

The stream watermark affects when the rows are flushed.
It does not upgrade a derived relationship into `proven`.

## `fallback`: `A || B`

This is the stability case.

Here the library still needs a reproducible output order, but the available evidence
is not strong enough to justify a stronger claim.

In the current runtime, `fallback` usually means:

* no explicit causal evidence
* no useful stronger ordering signal
* same event-time cluster, so a deterministic tie-break is used

In batch mode, `A || B` is not written as a literal concurrency marker.
Instead, one event is emitted first and the other second using deterministic rules.

Typical emitted shape:

```ts
const result = orderEvents([A, B])

result.ordered
// [
//   {
//     event: A,
//     orderIndex: 0n,
//     orderBasis: "deterministic_tiebreaker",
//     confidence: "fallback",
//   },
//   {
//     event: B,
//     orderIndex: 1n,
//     orderBasis: "deterministic_tiebreaker",
//     confidence: "fallback",
//   },
// ]
```

The chosen order comes from deterministic comparison rules such as:

* configured tie-breaker
* `nodeId`
* `event.id`

So `fallback` means:

* the output is stable
* the output is reproducible
* the output should not be mistaken for strong causal truth

In stream mode, the same fallback behavior applies inside the flushed window.
The stream still emits a deterministic order, but the rows remain `fallback`.

## `unknown`: `A ? B`

This is the case most people expect to be fully omitted.
That is not what the current runtime does.

### Pairwise `unknown`

If the pairwise comparison is `A ? B`, the library is saying:

* it cannot safely prove `A -> B`
* it cannot safely prove `B -> A`

That can happen because:

* the events are cross-node and independent under the supported evidence model
* metadata is weak
* metadata is invalid

In batch mode, that pairwise uncertainty often still produces written output.

If the events can still be placed deterministically, they are usually written as:

* `derived`, if HLC time or another usable signal places them
* `fallback`, if deterministic tie-breaking is needed

Example:

```ts
const result = orderEvents([A, B])

result.ordered
// [
//   {
//     event: A,
//     orderIndex: 0n,
//     orderBasis: "hlc",
//     confidence: "derived",
//   },
//   {
//     event: B,
//     orderIndex: 1n,
//     orderBasis: "hlc",
//     confidence: "derived",
//   },
// ]
```

So a pairwise `unknown` relationship does not automatically become emitted
`confidence: "unknown"`.

### Emitted `confidence: "unknown"`

This is the stricter failure-to-resolve case.

In batch mode, emitted `confidence: "unknown"` appears when the causal graph
cannot be fully resolved in non-strict mode, such as a dependency cycle.

Typical emitted shape:

```ts
const result = orderEvents([A, B], { strict: false })

result.ordered
// [
//   {
//     event: A,
//     orderIndex: 0n,
//     orderBasis: "deterministic_tiebreaker",
//     confidence: "unknown",
//   },
//   {
//     event: B,
//     orderIndex: 1n,
//     orderBasis: "deterministic_tiebreaker",
//     confidence: "unknown",
//   },
// ]

result.anomalies
// [
//   {
//     type: "unknown_order",
//     severity: "warning" | "error",
//     event: A | B,
//     message: "Event could not be fully placed by causal ordering and was appended deterministically",
//   },
// ]
```

If `strict: true` is enabled, the runtime throws instead of writing these unresolved
events into ordered output.

In stream mode, the same distinction applies within each flushed window:

* pairwise `A ? B` may still be emitted as `derived` or `fallback`
* emitted `confidence: "unknown"` only appears when the flushed window itself
  contains unresolved ordering that the runtime appends deterministically

## What Streaming Adds

The stream path uses the same ordering logic as batch, but only on the subset of
validated events that are ready for the current watermark.

So the stream answer is always:

* what can be written now?
* with what confidence?
* subject to what late-arrival policy?

That means the same four confidence states can appear in `batch.events`, but only
for the currently flushed window.

Typical stream batch shape:

```ts
for await (const batch of orderEventStream(source(), {
  lateArrivalPolicy: "emit_correction",
  strict: false,
})) {
  batch.events
  batch.anomalies
  batch.watermark
  batch.correction
  batch.isFinal
}
```

Important stream-specific rules:

* `proven`, `derived`, `fallback`, and `unknown` still describe ordered entries
* watermark advancement decides when ready events are flushed
* `lateArrivalPolicy` decides how late events are handled operationally
* non-final output may later need reconciliation
* earlier emitted windows are not retained for full cross-window relational comparison

## Practical Summary

If you persist ordered output, the safest interpretation is:

* `proven`: safe to treat as explicit causal placement
* `derived`: useful operational order, but not proof
* `fallback`: stable output shape only
* `unknown`: unresolved ordering warning; do not treat as reliable placement

And for `A ? B`, remember the key rule:

* pairwise `unknown` often still gets written
* emitted `confidence: "unknown"` is rarer and means the graph could not be fully resolved
