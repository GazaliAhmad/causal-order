# After-Hours Batch Processing

One of the cleanest operational uses of `causal-order` is not continuous streaming.
It is scheduled batch processing after business hours or during off-peak windows.

This guide explains that model, why it was the right `0.2.2` hardening story for the library, and how to preserve honest ordering when the central DB is updated in batches instead of continuously.

## When This Model Fits

Use this pattern when:

* events are produced during the day across services, devices, or local systems
* cost or operational simplicity makes continuous writes undesirable
* you want to replay and order a bounded backlog after midnight or during off-peak hours
* the central DB should be updated in one controlled batch instead of many small live updates

This is not an outage-only pattern.
It is a normal operating model for teams that prefer scheduled reconciliation.

## The Core Idea

The library is already strong at bounded batch ordering.

That means the flow can be:

1. collect raw events during the business day
2. preserve their original metadata
3. run a scheduled batch job later
4. pass the finite backlog into `orderEvents()`
5. write ordered results and anomalies back into central storage

This remains the simpler bounded-backlog path even now that `0.3.0` covers the first baseline streaming contract.

## What Metadata Matters

For this pattern to work well, each raw event should preserve:

* `id`
* `nodeId`
* `clock`
* `sequence` for same-node monotonic history
* `parentEventId` when one event directly follows from another
* `dependencyEventIds` when an event depends on several earlier events
* `payload`

Recommended event shape:

```ts
type EventRecord = {
  id: string
  nodeId: string
  clock: {
    physicalTimeMs: bigint
    logicalCounter: number
    nodeId: string
  }
  sequence?: bigint
  parentEventId?: string
  dependencyEventIds?: string[]
  traceId?: string
  partition?: string
  ingestedAt?: bigint
  payload: unknown
}
```

## What HLC Does Here

HLC is useful in this model, but it should be understood correctly.

The HLC clock:

* gives each event a stable physical-plus-logical timestamp
* helps preserve monotonic ordering even when wall clock time does not move cleanly
* supports deterministic `derived` ordering when stronger causal evidence is absent

But HLC does not replace explicit causality.

That means:

* `parentEventId`
* `dependencyEventIds`
* same-node monotonic `sequence`

are still the stronger signals for causal truth.

The practical split is:

* HLC helps place events honestly in time-aware order
* `sequence` preserves same-node truth
* explicit dependency metadata preserves real causality

## Recommended Batch Flow

During the day:

* write raw events into a local queue, staging table, or append-only store
* do not rewrite their original HLC or dependency metadata

After business hours:

1. load the bounded backlog
2. run `orderEvents()` on that batch
3. persist ordered results
4. persist anomalies separately
5. keep the raw events as the source of truth

Example batch job shape:

```ts
import { orderEvents } from "causal-order"

const result = orderEvents(backlog, {
  strict: false,
  detectAnomalies: true,
})

await writeOrderedEvents(result.ordered)
await writeAnomalies(result.anomalies)
await markBatchComplete(result.stats)
```

## Recommended DB Pattern

A good operational layout is:

* `raw_events`
* `ordered_events`
* `event_anomalies`
* optional `batch_runs`

Why this split helps:

* `raw_events` preserves original evidence
* `ordered_events` is derived state
* `event_anomalies` makes corruption, duplication, conflicts, and inversions inspectable
* `batch_runs` supports auditability for when and how a replay batch was processed

## What The Library Can Guarantee

In this batch model, the library can reliably help with:

* same-node ordering when `sequence` is usable
* explicit parent/dependency causal reconstruction
* deterministic output for operational use
* duplicate, inversion, malformed-data, and conflict visibility

## What The Library Will Not Invent

The library will not create causality that the data never recorded.

So if:

* two nodes acted independently
* cross-node evidence is weak
* explicit links are missing

then some relationships may remain `derived` or `unknown`.

That is not failure.
That is the intended honesty of the model.

## Why This Still Matters After `0.3.0`

`0.2.2` was the stress-hardening follow-up in the `0.2.x` line.

That means one of the strongest current operational stories remains:

* bounded large-batch processing
* realistic corrupted-dataset handling
* anomaly visibility
* deterministic replay behavior

The `150k` stress work makes this after-hours batch model more credible, because it shows the library is not only semantically careful on tiny fixtures.

It is also usable on serious bounded backlogs.

## Relationship To `0.3.0`

This guide describes the batch recovery and scheduled reconciliation story.

`0.3.0` is the step where the same event model now works in ordinary continuous operations as well as continuous recovery or continuous sync flows.

That means:

* batch mode uses HLC plus event metadata to order a finite replayed backlog
* `0.3.0` streaming mode uses the same event model, but adds watermark, lateness, correction, and the current stream-facing parameters for both normal live operations and reconnect-heavy flows
* `0.3.1` is where the remaining stream semantic edge cases should be tightened:
  * watermark callback semantics
  * invalid-event interaction with watermark advancement
  * boundary rules for lateness vs readiness
  * cross-window anomaly behavior
* `0.3.2` is where the additional streaming pressure work should land:
  * pathological late arrivals
  * correction-window hardening
  * watermark pressure
  * bounded-memory demonstration and backpressure guidance

So this guide is not being replaced by `0.3.0`.
It is the simpler operational sibling of the streaming story.
