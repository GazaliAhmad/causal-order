# Replay Inspection Workflow

This guide is the first `0.6.0` operational playbook for bounded replay inspection.

It is not trying to replace the broader [After-Hours Batch Processing](../after-hours-batch-processing.md) guide.
It is the narrower operator-facing follow-through that answers:

* how should a team inspect replay output before writing or publishing derived state?
* what should be persisted separately?
* where do the new `inspect` helpers fit into that workflow?

## When This Workflow Fits

Use this guide when:

* the backlog is finite
* you want to review ordering output before downstream writeback
* anomalies are part of the operational answer, not only debugging noise
* you need an auditable replay run rather than one opaque batch mutation

This is especially useful when:

* a central service was unavailable for several hours
* several producers kept collecting raw events locally
* the backlog is large enough that replay is a meaningful operational step on its own

## The Core Replay Shape

The safest first replay workflow is:

1. load the bounded backlog
2. run `orderEvents()`
3. inspect the result before projecting it
4. persist raw events, ordered output, and anomalies separately
5. only then update downstream derived state

That means replay should be treated as:

* a reconstruction step
* an inspection step
* a projection step

not as one silent write-through operation.

## Recommended Replay Output Split

The first safe table or storage split is:

* `raw_events`
* `replay_runs`
* `ordered_events`
* `event_anomalies`

Why this helps:

* `raw_events` preserves original evidence
* `replay_runs` records when and why a replay happened
* `ordered_events` stores the derived ordering answer
* `event_anomalies` keeps suspicious or invalid cases visible

If the downstream write needs stronger auditability, add:

* `replay_run_summaries`

That summary row is a good place for:

* event counts
* anomaly counts
* high-level inspection notes
* replay status

## Where The `inspect` Helpers Fit

The new `0.6.0` helper layer is meant to reduce ad hoc operator glue:

* `inspectOrderResult()` gives a compact replay snapshot
* `summarizeEventAnomalies()` gives quick anomaly counts
* `explainOrderedEvent()` gives a compact event-level reason string when one row needs explanation

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

await writeReplayRun({
  stats: inspection.stats,
  orderCounts: inspection.counts,
  anomalySummary: inspection.anomalySummary,
})

await writeOrderedEvents(result.ordered)
await writeAnomalies(result.anomalies)
```

The point is not to replace the raw result.
The point is to make the replay easier to inspect before more state is derived from it.

## What To Check Before Writeback

Before applying a replay result downstream, check:

* did the anomaly count spike unexpectedly?
* is the ordering basis mostly what you expected?
* are there more `fallback` or `unknown` conclusions than usual?
* did invalid events remain visible instead of being hidden?
* do any specific anomalous rows need event-level explanation before projection?

The compact inspection layer is especially good for:

* dashboards
* operator runbooks
* replay audit rows
* CI-style replay verification on known fixtures

## Event-Level Inspection

If a specific ordered row needs explanation, inspect it directly:

```ts
import {
  explainOrderedEvent,
  orderEvents,
} from "causal-order"

const result = orderEvents(backlog)
const entry = result.ordered.find((item) => item.event.id === "evt-123")

if (entry) {
  console.log(explainOrderedEvent(entry).summary)
}
```

That summary is intentionally small.
It does not invent domain truth.
It only explains the current runtime ordering basis, confidence, and causal evidence.

## Safe Writeback Rule

Do not let replay inspection become a shadow rewrite layer.

That means:

* do not mutate ordered rows during inspection
* do not silently drop anomalous rows just because the summary looked noisy
* do not turn operator summaries into a hidden filter that changes the stored history

The safe order is:

1. inspect
2. persist the raw result
3. project or publish derived state

## Practical First Projection Pattern

For a first bounded replay deployment:

* keep raw events immutable
* keep anomalies queryable
* keep ordered rows queryable
* let user-facing projections read from the ordered rows rather than directly from raw replay input

That gives the team a stable place to answer:

* what came in?
* what ordering answer was derived?
* what looked suspicious?
* what was projected downstream?

## Relationship To The Existing Batch Guide

Use [After-Hours Batch Processing](../after-hours-batch-processing.md) for the broader operational model.
Use [Operator Metrics Guide](./operator-metrics-guide.md) when the next question is what replay counters or anomaly trends to track over time.

Use this replay-inspection guide when the harder question is:

* how do we inspect and persist the result honestly before downstream writeback?

That is the narrower `0.6.0` follow-through this guide covers.
