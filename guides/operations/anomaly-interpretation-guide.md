# Anomaly Interpretation Guide

This guide is the operator-facing playbook for reading `causal-order` anomaly output without overclaiming what the runtime knows.

It does not replace the older [Anomaly Surface Audit](../hardening/anomaly-surface-0.3.2.md).
That audit explains the shape of the public anomaly surface.
This guide answers the narrower operational question:

* what does this anomaly usually mean in practice?
* what should a team check next?
* what should not be assumed from the anomaly alone?

## Working Rule

Anomalies are part of the answer, not only debugging noise.

So the first safe rule is:

* read anomalies together with the workflow shape
* read anomalies together with order basis and confidence
* treat anomaly clusters as operational signals, not instant root-cause proof

That means the same anomaly can matter differently in:

* bounded replay review
* correction-capable streaming
* raw-record translation

## First Triage Questions

Before interpreting one anomaly type too aggressively, ask:

1. is this replay, streaming, or translation output?
2. is the anomaly isolated or clustered?
3. is it concentrated on one source, mapper, node, or partition?
4. did order basis or confidence mix change at the same time?
5. is the downstream workflow supposed to reject, inspect, or reconcile this shape?

Those five questions usually tell you whether the problem is:

* malformed input
* delayed input
* duplicate or replayed history
* same-node sequencing trouble
* weaker causal certainty than the caller hoped for

## Event Anomalies

### `invalid_clock`

Usually means:

* one or more events failed the required clock contract
* the runtime kept the corruption visible instead of silently normalizing it

Check next:

* which producer emitted the event?
* is the clock structurally malformed, or did one field drift out of contract?
* is this one bad row, or a wider producer regression?

Do not assume:

* that the whole batch is unusable
* that the problem is always clock skew rather than malformed data

### `future_timestamp`

Usually means:

* a validated event clock is significantly ahead of the local validation horizon
* the data may still be structurally valid even though the timestamp looks suspicious

Check next:

* whether one producer clock is ahead
* whether the validation environment clock is the unusual side
* whether this started after a deploy, host move, or time-sync incident

Do not assume:

* that future-looking time proves malicious or broken intent
* that the ordering result is automatically false

### `missing_sequence`

Usually means:

* the event is valid enough to process, but same-node monotonic sequence evidence is absent
* the runtime may need to rely on weaker evidence such as HLC or explicit dependencies

Check next:

* whether the source is expected to emit sequence metadata
* whether this is normal for that workload or a producer regression
* whether the missing sequence coincides with more `derived`, `fallback`, or `unknown` conclusions

Do not assume:

* that the event is invalid
* that missing sequence alone explains every downstream anomaly

### `duplicate_event`

Usually means:

* the same event id appeared more than once
* replay, duplicate upload, or upstream dedupe failure is now visible directly

Check next:

* whether the duplicates are exact replay copies or conflicting payload history
* whether one import, replay job, or producer dominates the duplicates
* whether a reconnect or backfill flow recently changed

Do not assume:

* that duplicates are harmless just because ordering still completed
* that the runtime has deduplicated business truth for you

### `sequence_regression`

Usually means:

* a same-node event sequence moved backward relative to what the runtime already saw
* the node-local history may have replay, reset, corruption, or ingestion-shape trouble

Check next:

* whether one node restarted, replayed stale history, or reset its local sequence
* whether the regression is isolated or repeated
* whether the same node also emits `duplicate_event` or `invalid_clock`

Do not assume:

* that this is always a clock problem
* that a regression automatically invalidates every event from that node

### `same_node_sequence_conflict`

Usually means:

* two same-node events claim the same sequence position without one clean monotonic history
* the runtime kept the conflict visible instead of inventing a local truth

Check next:

* whether the node produced duplicate sequence numbers
* whether replayed or reconstructed events were merged into the same node history
* whether this is concentrated on one producer instance

Do not assume:

* that the library can choose the canonical event automatically
* that the conflict is safe to hide just because payloads look similar

### `causal_inversion`

Usually means:

* explicit causal evidence says one event depends on another
* clock appearance makes that relationship look backward

Check next:

* whether the parent or dependency edge is expected and trustworthy
* whether one producer clock is misleadingly ahead or behind
* whether this is a reconnect or replay pattern rather than an application logic break

Do not assume:

* that the parent-child relationship is false
* that HLC order should override explicit causal evidence

### `unknown_order`

Usually means:

* the runtime refused to invent stronger certainty for unresolved placement
* the events may be independent, weakly evidenced, or simply under-described

Check next:

* whether explicit dependencies are missing from the source history
* whether the caller expected sequence or parent metadata that never arrived
* whether this is a normal cross-node independence case or an unexpected ambiguity spike

Do not assume:

* that `unknown_order` means the runtime failed
* that downstream code can quietly treat it as one stable causal truth

### `late_arrival`

Usually means:

* the event arrived after the active readiness boundary for the stream
* the stream contract is surfacing operational lateness honestly

Check next:

* whether reconnect, backlog upload, or delayed ingestion is expected for this workload
* whether `batch.correction` is becoming common enough to stress downstream reconciliation
* whether one source is generating most late arrivals

Do not assume:

* that the producer is broken only because data was late
* that a late arrival is the same thing as invalid event content

## Translation Anomalies

For raw-record ingress, interpret translation anomalies separately from ordered-event anomalies.

The current translation surface is narrower and more structured:

* `missing_required_value`
* `invalid_mapped_value`
* `mapper_exception`

Interpret them with:

* `field`
* `mapper`
* `stage`
* `policy.action`

### `missing_required_value`

Usually means:

* a required mapped field such as event id, node id, or physical time was absent

Check next:

* whether the source record shape changed
* whether one mapper stopped reading the right field
* whether only one upstream source is affected

### `invalid_mapped_value`

Usually means:

* the mapper returned a value, but it did not satisfy the public contract for that field

Check next:

* whether one field changed type or format
* whether timestamp coercion or relationship-shape handling drifted
* whether the anomaly is clustered on one mapper or one source feed

### `mapper_exception`

Usually means:

* the mapper logic itself threw while translating a record

Check next:

* whether the mapper now assumes a source shape that is no longer true
* whether one code path or one record family triggers the exception
* whether the policy should stay warning-visible or fail fast for that workflow

Do not assume:

* that translation anomalies are downstream ordering bugs
* that lower translation anomaly totals imply stronger causal certainty later in the pipeline

## Cluster Patterns

Use anomaly clusters to guide the next investigation step:

* `duplicate_event` plus `sequence_regression`:
  usually replay, stale resend, or same-node history repair trouble
* `late_arrival` plus frequent `batch.correction`:
  usually reconnect or backlog upload pressure, not silent eventual consistency
* `invalid_clock` plus translation anomalies:
  usually ingress-shape or mapper contract drift before deeper ordering logic matters
* `missing_sequence` plus more `unknown_order`:
  usually weaker evidence quality rather than one dramatic corruption event
* `causal_inversion` in a narrow source cluster:
  usually misleading clocks or replay appearance around a still-real dependency edge

## Relationship To Confidence And Order Basis

Do not read anomalies in isolation from the ordered output.

Also check:

* are more rows now `derived`, `fallback`, or `unknown`?
* did the order basis shift from `sequence` or `causal` toward `hlc` or deterministic fallback?
* did anomaly severity change from mostly `info` to more `warning` or `error`?

That combined view is often more useful than raw anomaly count alone.

## A Small Triage Snapshot

The first good operator snapshot is often:

* anomaly summary by type and severity
* order-basis counts
* confidence counts
* one or two event-level explanations for the rows under review

Typical shape:

```ts
import {
  explainOrderedEvent,
  inspectOrderResult,
  orderEvents,
} from "causal-order"

const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})

const inspection = inspectOrderResult(result)
const suspicious = result.ordered[0]

console.log(inspection.anomalySummary)
console.log(inspection.counts)

if (suspicious) {
  console.log(explainOrderedEvent(suspicious).summary)
}
```

## What Not To Overclaim

Stay conservative about what anomaly output proves.

In particular:

* anomaly count is not root-cause analysis
* lower anomaly totals do not mean stronger causal truth
* one anomaly type can describe several real-world failure shapes
* some scenario categories are still represented through ordering behavior plus generic anomalies rather than one dedicated domain-specific signal

## Relationship To The Existing Guides

Use [Replay Inspection Workflow](./replay-inspection-workflow.md) when the next question is how replay output should be inspected and persisted.
Use [Streaming Reconciliation Workflow](./streaming-reconciliation-workflow.md) when the next question is how correction-capable stream batches should be applied downstream.
Use [Operator Metrics Guide](./operator-metrics-guide.md) when the next question is what to graph or alert on over time.
Use [Anomaly Surface Audit](../hardening/anomaly-surface-0.3.2.md) when you need the deeper contract-facing explanation of which anomalies exist directly today and which limitations remain explicit in the current payload-agnostic core.
