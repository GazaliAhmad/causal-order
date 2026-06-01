# Incident Review Guide

This guide is the operator playbook for using `causal-order` during incident-style review.

It is not a replacement for your incident process, ticketing system, or timeline template.
It answers the narrower package-facing question:

* how should a team use ordering output, anomalies, correction metadata, and replay inspection when a distributed event history looks suspicious?

## When This Guide Fits

Use this guide when:

* an outage, backlog replay, or delayed reconnect made the timeline hard to trust
* different systems disagree about what happened first
* duplicates, inversions, or late arrivals are part of the incident picture
* the team needs an operationally honest reconstruction before writing a clean retrospective story

Typical examples:

* replay-heavy recovery after a service outage
* reconnect storms after regional partition or offline sync
* timeline disputes between a primary service, background worker, and downstream projection
* incident review where timestamp order alone now looks suspicious

## The Core Rule

During incident review, treat the package output as evidence plus interpretation, not as one final magical answer.

That means:

* raw events remain source evidence
* ordered rows remain derived explanation
* anomalies remain part of the incident facts
* correction notices remain part of the incident facts

Do not flatten those into one "clean timeline" too early.

## First 15-Minute Triage

Start with five questions:

1. is this bounded replay, live streaming, or both?
2. are we looking at malformed input, delayed input, or conflicting input?
3. which anomalies are new, and which are expected for this workload?
4. did the order basis or confidence mix change?
5. is downstream state wrong because evidence changed, because interpretation changed, or because projection handling ignored correction signals?

The goal of the first pass is not root-cause certainty.
It is to narrow the shape of the problem honestly.

## The Fastest Safe Workflow

The first safe incident workflow is:

1. keep the raw evidence set
2. run the relevant package path
3. inspect summary output
4. inspect anomaly clusters
5. inspect one or two key rows directly
6. only then write or present the incident narrative

In package terms, that usually means:

* `translateBatch()` if the source records are still raw
* `orderEvents()` for bounded incident replay
* `orderEventStream()` if delayed reconnect or correction-capable streaming is the actual incident shape
* `inspectOrderResult()` or `inspectOrderBatch()` for the compact first read
* `explainOrderedEvent()` when one row needs a direct explanation

## Bounded Replay Incident Path

Use the replay path when the incident backlog is finite and inspectable.

Typical shape:

```ts
import {
  inspectOrderResult,
  orderEvents,
} from "causal-order"

const result = orderEvents(backlog, {
  strict: false,
  detectAnomalies: true,
})

const inspection = inspectOrderResult(result)

console.log(inspection.stats)
console.log(inspection.counts)
console.log(inspection.anomalySummary)
```

Check first:

* did `duplicate_event` or `sequence_regression` spike?
* are more rows now `derived`, `fallback`, or `unknown`?
* are explicit causal edges still the strongest explanations?
* did replayed history distort timestamp appearance without changing the real evidence?

Use this path when the main question is:

* what does the backlog reconstruction say before we touch downstream state again?

## Streaming Incident Path

Use the streaming path when the incident shape includes delayed reconnect, late arrivals, or correction-capable follow-through.

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

  console.log(inspection.watermark)
  console.log(inspection.correction)
  console.log(inspection.anomalySummary)
}
```

Check first:

* is `late_arrival` concentrated on one source or the whole workload?
* are correction-capable batches occasional or constant?
* did the stream keep making honest progress, or did the watermark stall?
* is downstream confusion actually a projection-reconciliation issue rather than an ordering issue?

Use this path when the main question is:

* what changed after the stream had already started emitting derived state?

## The Three Fastest Reads

In practice, the fastest useful incident read is:

* anomaly summary by type and severity
* order-basis and confidence counts
* one or two row-level explanations for the disputed events

That usually tells you whether the incident is primarily:

* replay corruption
* delayed-arrival reconciliation pressure
* malformed ingress
* weaker-than-expected causal evidence
* same-node sequencing trouble

## What To Look For By Symptom

If the incident symptom is "timeline looks newer than it should":

* check `duplicate_event`
* check `causal_inversion`
* check whether replayed rows only look newer by clock appearance

If the symptom is "device or region history arrived too late":

* check `late_arrival`
* check `batch.correction`
* check whether same-node sequence still preserves the local history

If the symptom is "projection changed after we thought it had settled":

* check correction-capable batches
* check whether non-final output was treated as settled truth
* check whether anomalies were dropped from the operator view

If the symptom is "ordering feels weak or ambiguous":

* check `missing_sequence`
* check `unknown_order`
* check whether the source event model is missing explicit dependencies

## What Not To Do

Avoid these incident-review mistakes:

* do not sort by timestamp alone just because the incident is urgent
* do not delete or hide anomalies to produce a cleaner retrospective
* do not treat correction-capable output as if it were silent eventual consistency
* do not turn one anomaly type into a root-cause declaration too early

The package is useful here because it helps teams resist those shortcuts.

## A Minimal Incident Record

The first useful incident note usually includes:

* evidence window reviewed
* workflow used: replay, stream, or translation plus replay
* anomaly summary
* order-basis and confidence mix
* whether correction-capable output was involved
* the one or two rows that best explain the timeline dispute

That gives the team a shared starting point before domain-specific remediation starts.

## Relationship To Other Guides

Use [Replay Inspection Workflow](./replay-inspection-workflow.md) when the main question is how to inspect bounded replay before writeback.
Use [Streaming Reconciliation Workflow](./streaming-reconciliation-workflow.md) when the main question is how correction-capable batches should be persisted and applied downstream.
Use [Anomaly Interpretation Guide](./anomaly-interpretation-guide.md) when the main question is what a specific anomaly type or anomaly cluster usually means.
Use [Operator Metrics Guide](./operator-metrics-guide.md) when the main question is what to graph, alert on, or compare over time.
Use [AWS-Inspired DynamoDB Outage Exercise](../aws-inspired-dynamodb-outage.md) when you want a larger streaming outage analog with delayed reconnect and correction churn.
