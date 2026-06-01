# Streaming Reconciliation Workflow

This guide is the operational playbook for correction-capable streaming follow-through.

It does not replace the broader [Streaming Recovery And Resync](../streaming-recovery-resync.md) guide.
It answers the narrower workflow question:

* what should an operator or maintainer do after `orderEventStream()` emits correction-capable output?

## When This Workflow Fits

Use this guide when:

* stream output must keep moving while some producers reconnect later
* late arrivals are part of the real workload
* downstream state is derived and may need replacement
* you need a repeatable rule for handling `batch.correction`

This is the right fit for:

* reconnect-heavy stream processing
* offline-sync recovery
* regional or service partitions followed by later backlog upload

## The Core Rule

The stream contract is honest about one important thing:

* non-final output may later need reconciliation

So the first safe rule is:

* treat emitted stream batches as derived state
* treat `batch.correction` as a machine-readable repair signal
* keep raw events and anomalies separately from the user-facing projection

That means the workflow should not be:

* receive a batch
* overwrite the user-facing record directly
* forget the earlier non-final history ever existed

## The Minimal Reconciliation Shape

The first safe streaming reconciliation workflow is:

1. ingest and store raw events
2. run `orderEventStream()`
3. persist emitted batches and anomalies
4. inspect correction-capable batches
5. update or rebuild the derived projection

That keeps the stream honest without requiring the core package to become a projection engine.

## Where The `inspect` Helpers Fit

The helper layer supports the operational check step:

* `inspectOrderBatch()` gives a compact batch snapshot
* `summarizeEventAnomalies()` gives quick anomaly counts
* `explainOrderedEvent()` helps explain one emitted row when operators need to understand why it moved

Typical shape:

```ts
import {
  inspectOrderBatch,
  orderEventStream,
} from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 500,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "emit_correction",
  strict: false,
})) {
  const inspection = inspectOrderBatch(batch)

  await writeStreamBatch(batch, inspection)
  await writeStreamAnomalies(batch.anomalies)

  if (batch.correction) {
    await reconcileProjection(batch)
  } else {
    await applyProjectionBatch(batch)
  }
}
```

The important point is that inspection does not replace the batch.
It records the batch in a more operator-friendly shape.

## What A Correction Batch Means Operationally

If `batch.correction` is present:

* late data has arrived
* previously emitted non-final output from the same stream instance may need reconciliation
* the emitted rows should be treated as newer derived state

It does not mean:

* the library knows your canonical database update strategy
* the library can pick the exact rows to patch in every downstream schema
* the library guarantees one direct write is enough for every projection shape

## Mutable Versus Append-Only Projections

If the downstream projection is mutable:

* treat non-final batches as replaceable
* update or replace affected derived rows when correction-capable output arrives
* keep the earlier batch history separately for auditability if needed

If the downstream projection is append-only:

* persist each emitted batch
* persist correction metadata and anomalies separately
* let a reconciliation reader or projector decide which newer derived rows supersede older ones

In both cases:

* raw events stay the source evidence
* emitted stream batches stay derived state

## A Safe Storage Split

A practical first split is:

* `raw_events`
* `stream_batches`
* `stream_anomalies`
* `derived_projection`

This lets the team answer:

* what arrived?
* what was emitted?
* what looked suspicious?
* what is the current downstream projection?

If a correction arrives later, the team can still inspect the older emitted state rather than pretending it never existed.

## What To Check On Correction-Capable Output

When `batch.correction` is present, check:

* which event triggered the correction?
* is the batch still non-final?
* did anomaly counts spike unusually?
* does the projection need row replacement, projection rebuild, or only append-only supersession handling?
* are operators prepared for newer derived rows to replace earlier ones?

The compact inspection snapshot is a good place to store:

* batch watermark
* correction trigger event
* anomaly summary
* order-basis and confidence counts

## The Main Failure To Avoid

Do not treat `emit_correction` as if it were silent eventual consistency.

That usually fails in one of these ways:

* non-final output is written as if it were settled truth
* correction signals are ignored because the first write “already happened”
* anomalies are dropped even though they explain why downstream state changed

The safer rule is:

* if the stream can emit correction-capable output, the projection must be able to tolerate replacement or supersession

## Relationship To The Existing Streaming Guide

Use [Streaming Recovery And Resync](../streaming-recovery-resync.md) for the broader stream contract and lateness semantics.
Use [Operator Metrics Guide](./operator-metrics-guide.md) when the next question is what to graph or investigate once correction-capable output is live.

Use this reconciliation workflow guide when the narrower question is:

* how should emitted correction-capable batches be persisted, inspected, and applied downstream?

That is the operational follow-through this guide is meant to cover.
