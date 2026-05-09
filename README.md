# causal-order

An event integrity library for distributed systems.

`causal-order` helps developers reconstruct event timelines without pretending the system knows more than it does.

Instead of only sorting by timestamp, it helps you:

* order what can be ordered
* preserve concurrency only when it can be justified honestly
* flag what is suspicious
* keep the difference between proof, inference, fallback, and unknown

## Why This Exists

Distributed systems produce misleading timelines all the time:

* clocks drift across regions
* replayed events can look newer than original events
* offline devices sync late
* ingestion order differs from creation order
* some events are truly concurrent

A naive timestamp sort produces a clean-looking answer.
That answer is often false.

`causal-order` exists to make that uncertainty visible instead of hiding it.

## What You Get

Given a set of distributed events, the library returns more than a sorted list.

It returns:

* `ordered`: events with `orderIndex`, `orderBasis`, and `confidence`
* `anomalies`: invalid, suspicious, or operationally important records
* `stats`: summary counts for the batch

Confidence is explicit:

* `proven`: explicit causal evidence exists
* `derived`: order was inferred from useful but weaker metadata
* `fallback`: deterministic ordering was imposed for stability
* `unknown`: the library cannot honestly justify the claim

Current semantic posture:

* cross-node events without explicit supported causal evidence should usually remain `unknown`
* supported causal evidence today is intentionally narrow:
  * `parentEventId`
  * `dependencyEventIds`
  * same-node monotonic `sequence`
* shared `traceId` or `partition` metadata does not, by itself, imply causality

## Install

```bash
npm install causal-order
```

Platform:

* Node.js `20+`
* ESM only

## Quick Example

```ts
import { orderEvents } from "causal-order"

const events = [
  {
    id: "evt-1",
    nodeId: "orders-api",
    clock: {
      physicalTimeMs: 1714971840123n,
      logicalCounter: 0,
      nodeId: "orders-api",
    },
    sequence: 1n,
    payload: { type: "order.created" },
  },
  {
    id: "evt-2",
    nodeId: "payments-worker",
    clock: {
      physicalTimeMs: 1714971840125n,
      logicalCounter: 1,
      nodeId: "payments-worker",
    },
    parentEventId: "evt-1",
    payload: { type: "payment.captured" },
  },
]

const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})

console.log(result.ordered)
console.log(result.anomalies)
```

Example output shape:

```ts
[
  {
    event: events[0],
    orderIndex: 0n,
    orderBasis: "sequence",
    confidence: "derived",
  },
  {
    event: events[1],
    orderIndex: 1n,
    orderBasis: "causal",
    confidence: "proven",
    causalEvidence: [{ type: "parent_event", parentEventId: "evt-1" }],
  },
]
```

The important part is not just the order.
It is the explanation of why that order exists and how trustworthy it is.

## Semantic Notes

Two rules matter especially for current releases:

* `concurrent` is not a polite word for "I don't know"
* lack of a visible causal edge should usually stay `unknown`, especially across nodes

That means:

* explicit parent and dependency links can produce `proven` causal ordering
* same-node monotonic sequence can produce strong ordering evidence
* HLC, ingestion order, shared `traceId`, or shared `partition` metadata can still be useful without becoming causal proof

## Common Workflow

### 1. Create or ingest clocks

```ts
import { createHlcClock } from "causal-order"

const clock = createHlcClock({
  nodeId: "api-sg-1",
})

const event = {
  id: "evt-1",
  nodeId: "api-sg-1",
  clock: clock.now(),
  payload: { type: "user.created" },
  sequence: 1n,
}
```

### 2. Validate events

```ts
import { validateEvent } from "causal-order"

const validation = validateEvent(event)

if (!validation.valid) {
  console.error(validation.errors)
}
```

### 3. Order the batch honestly

```ts
import { orderEvents } from "causal-order"

const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})
```

### 4. Inspect confidence and evidence

```ts
for (const item of result.ordered) {
  console.log(item.event.id, item.orderBasis, item.confidence)
}
```

## Streaming

For large or unbounded event flows, use `orderEventStream()` instead of pretending everything belongs in one in-memory batch.

```ts
import { orderEventStream } from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 100,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "flag",
  strict: false,
})) {
  console.log(batch.events)
  console.log(batch.anomalies)
  console.log(batch.watermark, batch.isFinal)
}
```

Important rule:

* stream finality is operational, not causal certainty

## When To Use It

`causal-order` is a good fit for:

* audit timeline reconstruction
* replay analysis
* multi-region debugging
* offline sync inspection
* late-arrival stream handling
* distributed incident analysis

It is especially useful when:

* events come from multiple services, devices, or regions
* timestamps are not enough on their own
* ordering claims need explanation
* concurrency matters
* suspicious metadata should not be silently normalized

## Realistic Workloads

This package is not designed around the idea that every user needs to sort millions of unrelated events in one call.

The more realistic question is:
how many events need to be interpreted together to answer one operational question honestly?

Typical real-world ranges are more often:

* `100` to `10,000` events for focused debugging or audit slices
* `10,000` to `100,000` events for larger replay, sync, or incident workloads
* `100,000+` events for heavier batch analysis, where benchmarking and batching matter

A practical mental model is:

* `10k` should feel easy
* `100k` should feel solid
* `150k` corrupted-dataset profiles are useful stress visibility for hardening work, but not yet the enforced baseline promise
* million-scale workloads should be treated as an explicit scalability target, not the default assumption

If the workload is naturally unbounded, `orderEventStream()` is the more honest model.

## What The Package Believes

`causal-order` is built around a simple idea:

> Be easy to use at the surface, but hard to misuse into false certainty.

That means:

* `concurrent` is not the same thing as `unknown`
* HLC ordering alone is useful, but not full proof
* shared `traceId` or `partition` metadata does not, by itself, prove causality
* deterministic output is not the same thing as justified causal order
* invalid or weak metadata should become visible, not silently repaired

## Why Not Just Use Clock Libraries?

There are already npm packages for pieces of this problem:

* vector clocks
* version vectors
* hybrid logical clocks
* infrastructure-specific causal ordering primitives

Those packages are useful, but they usually stop at the clock or ordering primitive itself.

`causal-order` is trying to solve a different package-level problem:

* validate distributed event records
* order batches of events
* surface concurrency explicitly
* detect anomalies
* return confidence and evidence with the result

So the goal is not to replace clock libraries.
It is to provide a higher-level event interpretation layer for developers who need an honest timeline, not just a timestamp primitive.

## Documentation

Conceptual docs:

* [Wiki Home](https://github.com/GazaliAhmad/causal-order/wiki)
* [What This Library Is](https://github.com/GazaliAhmad/causal-order/wiki/What-This-Library-Is)
* [The Problem With Distributed Timelines](https://github.com/GazaliAhmad/causal-order/wiki/The-Problem-With-Distributed-Timelines)
* [Confidence Levels](https://github.com/GazaliAhmad/causal-order/wiki/Confidence-Levels)
* [Concurrent vs Unknown](https://github.com/GazaliAhmad/causal-order/wiki/Concurrent-vs-Unknown)
* [Streaming Finality](https://github.com/GazaliAhmad/causal-order/wiki/Streaming-Finality)

Repository guides:

* [Guides Index](https://github.com/GazaliAhmad/causal-order/blob/main/guides/README.md)
* [Mental Model](https://github.com/GazaliAhmad/causal-order/blob/main/guides/mental-model.md)
* [Case Studies](https://github.com/GazaliAhmad/causal-order/blob/main/guides/case-studies.md)
* [Stress Hardening](https://github.com/GazaliAhmad/causal-order/blob/main/guides/stress-hardening.md)
* [Replay Corruption](https://github.com/GazaliAhmad/causal-order/blob/main/guides/replay-corruption.md)
* [Multi-Region Drift](https://github.com/GazaliAhmad/causal-order/blob/main/guides/multi-region-drift.md)
* [False Audit Timelines](https://github.com/GazaliAhmad/causal-order/blob/main/guides/false-audit-timeline.md)
* [Offline Sync Anomalies](https://github.com/GazaliAhmad/causal-order/blob/main/guides/offline-sync-anomalies.md)
* [Causal Inversion](https://github.com/GazaliAhmad/causal-order/blob/main/guides/causal-inversion.md)

Runnable repository examples:

* [Examples Index](https://github.com/GazaliAhmad/causal-order/blob/main/examples/README.md)

## Status

`causal-order` is currently in the public `0.2.x` release line. `0.2.2` is the stress-hardening follow-up in that line, and `0.3.0` is the next planned streaming milestone.

The recent `0.2.x` work reflects the semantics hardening that began during late `0.1.x` preparation, continued through the `0.2.0` public baseline, passed through an internal `0.2.1` repo step, and was followed by corrupted-dataset stress hardening in `0.2.2`, so the eventual `1.0` contract can be tighter and more settled.

That means:

* the package is usable today
* the API is expected to evolve
* semantics matter more than surface churn at this stage
* the next major area of hardening after `0.2.2` is streaming behavior, which is the current `0.3.0` direction
* `1.0.0` is the point where the semantic contract should feel stable enough to preserve long-term

## Repository Development

If you are working in the repository itself:

```bash
npm install
npm run check
npm test
npm run bench:check
```

Useful local commands:

* `npm run demo`
* `npm run examples`
* `npm run bench`
* `npm run bench:all`
* `npm run bench:csv`
* `npm run bench:profile`

The perf guard is intentionally a broad safety rail, not a machine-independent promise.
It is meant to catch obvious regressions in realistic workload bands.

Current benchmark posture:

* `10k` and `100k` are the main enforced guardrail bands
* `150k` corrupted-dataset profiles are available for stress visibility, but are not currently enforced in `npm run bench:check`
* `npm run bench:profile` is available when you need CPU profiles for the slowest stress cases

## License

MIT. See [LICENSE](https://github.com/GazaliAhmad/causal-order/blob/main/LICENSE).
