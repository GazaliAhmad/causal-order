# Operator Metrics Guide

This guide is the current operator-facing metrics playbook for `causal-order`.

It is not trying to define a full observability platform.
It is answering the narrower practical question:

* what should operators watch first once replay and streaming workflows are live?

## Working Rule

The package emits ordering results, anomalies, stream batches, watermarks, and correction notices.
It does not ship a metrics backend, dashboard product, or alerting system.

So the safe rule is:

* derive metrics from the runtime output
* keep those metrics honest about what the runtime actually knows
* do not promote operational counters into stronger causal claims than the package can justify

## The First Four Metrics Families

Operators should track:

* watermark progress
* late-arrival frequency
* anomaly-rate monitoring
* correction-rate monitoring

Those four are enough to answer the first operational questions:

* is the stream moving?
* is delayed data becoming normal?
* is the input quality drifting?
* is downstream reconciliation pressure increasing?

## 1. Watermark Progress

Watermark progress answers:

* is the stream still making honest forward progress?
* are ready windows being emitted?
* is the pipeline stalling under lag or idle input?

The runtime already exposes:

* `batch.watermark`
* `batch.isFinal`
* stream batches emitted by `orderEventStream()`

What to record first:

* latest emitted watermark
* time since watermark last advanced
* batches emitted per interval
* empty-versus-non-empty emitted batch counts when that matters operationally

What to watch for:

* watermark not advancing for longer than the workload expects
* many repeated batches with little effective progress
* a backlog growing upstream while emitted progress stays flat

What not to overclaim:

* watermark progress is not proof of causal completeness
* a moving watermark does not mean the stream is anomaly-free
* a stalled watermark may reflect workload shape or watermark strategy, not only failure

## 2. Late-Arrival Frequency

Late-arrival frequency answers:

* how often is data arriving after the active readiness boundary?
* is reconnect or backlog upload becoming more common?
* is operational lateness normal for this workload or starting to drift?

The runtime already exposes:

* `late_arrival` anomalies
* `batch.correction` for `lateArrivalPolicy: "emit_correction"`

What to record first:

* late-arrival anomaly count per interval
* late-arrival anomaly count per producer, node, or source if your wrapper tracks that dimension
* percentage of emitted batches that carry `batch.correction`

What to watch for:

* sudden spikes in `late_arrival`
* one source contributing most of the lateness
* sustained late-arrival pressure that turns correction-capable output into the ordinary case

What not to overclaim:

* late arrival is an operational signal, not proof that a producer is broken
* some workloads honestly have frequent reconnect or delayed-upload behavior
* the metric should be interpreted against the chosen watermark strategy and `maxLateArrivalMs`

## 3. Anomaly-Rate Monitoring

Anomaly-rate monitoring answers:

* is input quality drifting?
* are suspicious or malformed cases increasing?
* is a deployment or upstream change creating noisier event history?

The runtime already exposes:

* `result.anomalies`
* `batch.anomalies`
* `summarizeEventAnomalies()`
* `summarizeTranslationAnomalies()`

What to record first:

* total anomaly count per replay run or stream interval
* anomaly counts by type
* anomaly counts by severity
* translation anomaly counts by field, mapper, stage, and policy action when raw-record ingress is part of the workflow

Typical first split:

* batch replay anomaly summary
* stream-window anomaly summary
* translation anomaly summary

What to watch for:

* spikes in `invalid_clock`, `duplicate_event`, `causal_inversion`, or `late_arrival`
* a new translation anomaly cluster around one mapper or field
* severity mix changing from mostly `info` to more `warning` or `error`

What not to overclaim:

* anomaly count alone does not say whether downstream truth is unusable
* lower anomaly totals do not mean stronger causal certainty
* different workloads naturally produce different anomaly mixes

## 4. Correction-Rate Monitoring

Correction-rate monitoring answers:

* how often is the stream asking downstream systems to reconcile non-final output?
* is `emit_correction` still occasional or becoming the normal shape?
* how much replacement or supersession pressure is the projection layer under?

The runtime already exposes:

* `batch.correction`
* `batch.isFinal`
* correction trigger event ids

What to record first:

* correction-capable batches per interval
* ratio of correction-capable batches to ordinary emitted batches
* correction triggers by source or producer if the wrapper can add that dimension

What to watch for:

* correction batches becoming common enough that downstream replacement logic is under stress
* one producer repeatedly triggering most corrections
* correction churn staying elevated after a reconnect or outage should already have settled

What not to overclaim:

* a correction batch is not a failure by itself
* some reconnect-heavy workloads honestly need recurring reconciliation
* the metric should guide downstream operational posture, not only error counting

## Using The `inspect` Helpers

The helper layer is useful here because it keeps the first metrics pass small and package-facing:

* `inspectOrderResult()` gives replay stats, order-basis counts, confidence counts, and anomaly summaries
* `inspectOrderBatch()` gives batch watermark, correction metadata, order-basis counts, confidence counts, and anomaly summaries

Typical stream-side shape:

```ts
import {
  inspectOrderBatch,
  orderEventStream,
} from "causal-order"

for await (const batch of orderEventStream(source(), options)) {
  const inspection = inspectOrderBatch(batch)

  recordGauge("causal_order_watermark", Number(inspection.watermark))
  recordCounter("causal_order_batch_total", 1)
  recordCounter("causal_order_anomaly_total", inspection.anomalySummary.total)

  if (inspection.correction) {
    recordCounter("causal_order_correction_batch_total", 1)
  }
}
```

Typical replay-side shape:

```ts
import {
  inspectOrderResult,
  orderEvents,
} from "causal-order"

const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})

const inspection = inspectOrderResult(result)

recordCounter("causal_order_replay_run_total", 1)
recordCounter("causal_order_replay_anomaly_total", inspection.anomalySummary.total)
```

The exact metric names are up to the operator environment.
The important part is that the counters come from real emitted package output.

## First Dashboard Questions

If a team only builds one first dashboard, it should answer:

* what is the latest emitted watermark?
* how many late arrivals did we see recently?
* what anomaly types are rising?
* how many correction-capable batches did we emit recently?

That is enough for a first operational view without pretending the package already knows more than it does.

## First Alert Heuristics

This guide stays conservative.
So the first alert heuristics should be phrased as:

* investigate sustained watermark stall beyond expected idle windows
* investigate sudden late-arrival spikes beyond recent baseline
* investigate anomaly-rate spikes clustered on one event source, mapper, or anomaly type
* investigate sustained correction churn after reconnect recovery should already have stabilized

These are intentionally heuristics, not hard universal thresholds.

## One Reading Rule To Keep

Metrics help answer:

* is the operational picture changing?

They do not automatically answer:

* why is the domain truth changing?

So keep the split clear:

* counters and gauges describe operational pressure
* causal evidence and ordered results describe the current runtime answer
* anomalies and correction notices explain why operators may need to look closer

## Relationship To The Workflow Guides

Use [Replay Inspection Workflow](./replay-inspection-workflow.md) when the main question is how to inspect bounded replay before writeback.

Use [Streaming Reconciliation Workflow](./streaming-reconciliation-workflow.md) when the main question is how to apply correction-capable batches downstream.

Use this metrics guide when the main question is:

* what should operators count, graph, and investigate first?
