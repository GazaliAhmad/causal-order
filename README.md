# causal-order

An event integrity library for distributed systems that cannot rely on a globally synchronized clock.

`causal-order` helps developers design and run event processing, replay, and recovery flows without pretending the system has one perfect global time source.

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

## Mental Model

`causal-order` is built around a simple rule:

> Be easy to use at the surface, but hard to misuse into false certainty.

In practice, that means:

* not every event set should be forced into one total order
* explicit causal evidence outranks clock appearance
* cross-node events without supported causal evidence should usually remain `unknown`
* shared `traceId` or `partition` metadata does not, by itself, imply causality
* streaming finality is operational, not causal truth

Supported causal evidence today is intentionally narrow:

* `parentEventId`
* `dependencyEventIds`
* same-node monotonic `sequence`

This library is not trying to eliminate clocks.
It is trying to stop treating wall-clock agreement as the truth model for a distributed system.

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

## Streaming Overview

For large or unbounded event flows, use `orderEventStream()` instead of pretending everything belongs in one in-memory batch.

That includes both:

* ordinary day-to-day stream processing
* delayed reconnect, offline sync, or recovery flows where late arrivals are part of normal operations

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

Keep this mental model in mind:

* the watermark controls operational readiness, not causal truth
* late events are handled by explicit policy rather than being silently hidden
* non-final output may need later reconciliation, especially in reconnect-heavy flows

For the full stream contract, see:

* [Streaming Recovery And Resync](https://github.com/GazaliAhmad/causal-order/blob/main/guides/streaming-recovery-resync.md)
* [Streaming Finality](https://github.com/GazaliAhmad/causal-order/wiki/Streaming-Finality)

## When To Use It

`causal-order` is primarily for deployable operational event processing in distributed systems that cannot rely on one perfect global clock.

That includes:

* continuous stream processing with explicit late-arrival and reconciliation behavior
* delayed reconnect and recovery workflows
* offline sync inspection
* replay analysis

Other strong use cases include:

* multi-region debugging
* audit timeline reconstruction
* late-arrival stream handling
* distributed incident analysis

It is especially useful when:

* events come from multiple services, devices, or regions
* timestamps are not enough on their own
* ordering claims need explanation
* concurrency matters
* suspicious metadata should not be silently normalized

It is less useful when:

* you already have authoritative causal ordering elsewhere
* you only need a plain timestamp sort

## Documentation

Start here:

* [Wiki Home](https://github.com/GazaliAhmad/causal-order/wiki)
* [What This Library Is](https://github.com/GazaliAhmad/causal-order/wiki/What-This-Library-Is)
* [Mental Model](https://github.com/GazaliAhmad/causal-order/blob/main/guides/mental-model.md)
* [Clocks, Causality, And Why HLC](https://github.com/GazaliAhmad/causal-order/blob/main/guides/clocks-causality-and-why-hlc.md)

Streaming:

* [Streaming Recovery And Resync](https://github.com/GazaliAhmad/causal-order/blob/main/guides/streaming-recovery-resync.md)
* [Streaming Finality](https://github.com/GazaliAhmad/causal-order/wiki/Streaming-Finality)
* [Streaming Recovery and Resync Wiki](https://github.com/GazaliAhmad/causal-order/wiki/Streaming-Recovery-and-Resync)

Failure modes and case studies:

* [Case Studies](https://github.com/GazaliAhmad/causal-order/blob/main/guides/case-studies.md)
* [Replay Corruption](https://github.com/GazaliAhmad/causal-order/blob/main/guides/replay-corruption.md)
* [Multi-Region Drift](https://github.com/GazaliAhmad/causal-order/blob/main/guides/multi-region-drift.md)
* [False Audit Timelines](https://github.com/GazaliAhmad/causal-order/blob/main/guides/false-audit-timeline.md)
* [Offline Sync Anomalies](https://github.com/GazaliAhmad/causal-order/blob/main/guides/offline-sync-anomalies.md)
* [Causal Inversion](https://github.com/GazaliAhmad/causal-order/blob/main/guides/causal-inversion.md)

Workloads and hardening:

* [Production Gate `0.3.2`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/production-gate-0.3.2.md)
* [Anomaly Surface Audit `0.3.2`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/anomaly-surface-0.3.2.md)
* [Stress Hardening](https://github.com/GazaliAhmad/causal-order/blob/main/guides/stress-hardening.md)
* [After-Hours Batch Processing](https://github.com/GazaliAhmad/causal-order/blob/main/guides/after-hours-batch-processing.md)
* [Realistic Workloads](https://github.com/GazaliAhmad/causal-order/wiki/Realistic-Workloads)

Runnable examples:

* [Examples Index](https://github.com/GazaliAhmad/causal-order/blob/main/examples/README.md)
* [Streaming Recovery And Resync Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/streaming-recovery-resync.mjs)

## Status

`causal-order` is in the public `0.3.x` release line.

Current release shape:

* `0.3.1` is the current publish target and semantic-tightening follow-up to the published `0.3.0` baseline streaming release
* `0.3.2` is the next production-gate hardening follow-up for the settled `0.3.1` semantics
* `0.3.3` is the broader streaming hardening and pressure follow-up after that production-gate milestone

That means:

* the package is usable today
* the API is still evolving
* semantics matter more than surface churn at this stage
* `1.0.0` is the point where the semantic contract should feel stable enough to preserve long-term

## Repository Development

If you are working in the repository itself:

```bash
npm install
npm run check
npm test
npm run bench:check
npm run release:check
```

Useful local commands:

* `npm run demo`
* `npm run examples`
* `npm run bench`
* `npm run bench:stream`
* `npm run bench:all`
* `npm run bench:csv`
* `npm run bench:profile`

Current benchmark posture:

* `10k` and `100k` are the main enforced guardrail bands
* `150k` corrupted-dataset profiles are available for stress visibility, but are not currently enforced in `npm run bench:check`
* `npm run bench:profile` is available when you need CPU profiles for the slowest stress cases

## License

MIT. See [LICENSE](https://github.com/GazaliAhmad/causal-order/blob/main/LICENSE).
