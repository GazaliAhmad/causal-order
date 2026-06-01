# causal-order

<table border="0" cellpadding="0" cellspacing="0" style="border:none; border-collapse:collapse; margin-bottom:10px;">
  <tr style="border:none;">
    <td style="border:none; padding-right:8px;"><a href="https://github.com/GazaliAhmad/causal-order/actions"><img src="https://img.shields.io/github/actions/workflow/status/GazaliAhmad/causal-order/ci.yml?branch=main&style=flat-square&label=CI&color=blue&badgev=20260529" alt="CI Status"></a></td>
    <td style="border:none; padding-right:8px;"><a href="https://github.com/GazaliAhmad/causal-order"><img src="https://img.shields.io/badge/Dependencies-0%20%2F%20Zero-black?style=flat-square" alt="Zero Dependencies Unified"></a></td>
    <td style="border:none; padding-right:8px;"><a href="https://www.npmjs.com/package/causal-order"><img src="./website/public/package-footprint-badge.svg" alt="Package Footprint"></a></td>
    <td style="border:none; padding-right:8px;"><a href="https://github.com/GazaliAhmad/causal-order"><img src="https://img.shields.io/badge/Node.js-v24%20LTS%20Ready-green?style=flat-square" alt="Node Runtime"></a></td>
    <td style="border:none; padding:0;"><a href="https://github.com/GazaliAhmad/causal-order"><img src="https://img.shields.io/badge/150k%20Stress%20Profile-Passed%20%E2%9C%93-orange?style=flat-square" alt="Stress Profile"></a></td>
  </tr>
</table>

![causal-order banner](https://causal-order.gazali.one/readme-banner.svg)

An event integrity library for distributed systems that still use clocks, but cannot rely on one globally synchronized clock as the truth model.

`causal-order` helps developers design and run event processing, replay, and recovery flows without assuming the system has one perfect global time source. It does not replace clocks or timestamps; it helps when timestamp order alone is not enough to explain what happened.

Website: [https://causal-order.gazali.one](https://causal-order.gazali.one)

It helps you:

* order what can be ordered
* preserve concurrency only when it can be justified honestly
* flag what is suspicious
* keep the difference between proof, inference, fallback, and unknown

## Why This Exists

Distributed systems often produce misleading timelines:

* clocks drift across regions
* replayed events can look newer than original events
* offline devices sync late
* ingestion order differs from creation order
* some events are truly concurrent

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

Given a set of distributed events, the library returns:

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

ESM only.

Focused imports are also available when you want a narrower public entrypoint:

```ts
import { orderEvents } from "causal-order/order"
import { orderEvents as batchOrderEvents } from "causal-order/batch"
import { orderEventStream } from "causal-order/stream"
import { createProcessingTimeWatermark } from "causal-order/watermarks"
import { translateBatch } from "causal-order/translate"
import { createHlcClock } from "causal-order/clock"
```

## Runtime Policy

Current runtime posture:

* published package support starts at `Node.js >=20`
* active development and performance validation target `Node.js 24`
* CI still exercises `Node.js 18`, `20`, and `24` to catch regressions around the supported floor
* the package is ESM only

For the fuller compatibility and support boundary, see [COMPATIBILITY.md](https://github.com/GazaliAhmad/causal-order/blob/main/COMPATIBILITY.md).

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

## Default Option Posture

The default batch-ordering posture is designed to keep uncertainty visible instead of flattening it away:

```ts
const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})
```

The main options to understand are:

* `strict: false`
  keeps the run warning-visible by default so invalid or unresolved cases can surface as structured anomalies instead of stopping the whole batch immediately
* `allowUnknownOrder`
  defaults to an uncertainty-visible posture where unresolved placement can still be emitted with warning-level visibility in non-strict mode
* `detectAnomalies: true`
  keeps anomaly reporting on by default because the package treats anomaly visibility as part of the ordinary answer, not as a debugging extra

Two boundary rules matter here:

* setting `allowUnknownOrder: false` strengthens severity posture for unresolved output, but it does not invent stronger certainty or silently rewrite the ordering result
* setting `detectAnomalies: false` reduces emitted diagnostic output, but it does not make the result truer, cleaner, or more causally justified

If you are unsure, start with warning-visible defaults and tighten later once the surrounding workflow is actually prepared to reject uncertain input.

## Pairwise Helpers

When you need a direct helper rather than a full ordering pass, prefer the primary pairwise methods:

```ts
import { compareByHlc, compareDeterministically } from "causal-order"

const hlcRelation = compareByHlc(eventA.clock, eventB.clock)
const fallbackOrder = compareDeterministically(eventA, eventB, "event_id")

console.log(hlcRelation)
console.log(fallbackOrder)
```

As of `0.5.0`, the preferred names are:

* `compareByHlc()` for direct HLC comparison
* `compareDeterministically()` for deterministic fallback comparison

Older aliases may still exist for compatibility, but new code should prefer the primary names above.
The root `causal-order` import may still keep compatibility aliases when that reduces migration pain, but focused entrypoints already emphasize the primary names rather than mixed canonical-and-compatibility naming.

## Raw Record Translation

When your data is not already in the library's event-envelope shape, use `translateBatch()` first and then pass the translated records into `orderEvents()`.

```ts
import { orderEvents, translateBatch } from "causal-order"

const records = [
  {
    eventId: "evt-1",
    source: "orders-api",
    occurredAt: "1714971840123",
    sequence: 1n,
    body: { type: "order.created" },
  },
  {
    eventId: "evt-2",
    source: "payments-worker",
    occurredAt: 1714971840125,
    sequence: 1n,
    parent: "evt-1",
    body: { type: "payment.captured" },
  },
]

const translated = translateBatch(records, {
  getEventId: (record) => record.eventId,
  getNodeId: (record) => record.source,
  getPhysicalTime: (record) => record.occurredAt,
  getSequence: (record) => record.sequence,
  getParentEventId: (record) => record.parent,
  getPayload: (record) => record.body,
})

console.log(translated.anomalies)

const ordered = orderEvents(translated.translated, {
  strict: false,
  detectAnomalies: true,
})

console.log(ordered.ordered)
```

What matters most:

* required mappers: `getEventId`, `getNodeId`, `getPhysicalTime`
* accepted timestamp inputs: `bigint`, safe integer `number`, or canonical integer `string`
* rejected timestamp inputs include `Date`, ISO timestamp strings, decimals, exponent notation, and unsafe integers
* translated results split accepted records from structured translation anomalies

Keep pre-translation shaping narrow. Pass original source records into `translateBatch()` whenever possible and let it own coercion, rejection, and anomaly reporting.

If you need the deeper ingress-policy details, see:

* API: [translateBatch()](https://causal-order.gazali.one/api/translate-batch/)
* Guide: [Policy Guidance](https://causal-order.gazali.one/guides/policy-guidance/)

## Operational Inspection Helpers

For operational review, replay audits, or emitted-batch inspection, the current release includes a small additive helper layer on top of the core runtime output:

```ts
import {
  inspectOrderResult,
  orderEvents,
  summarizeTranslationAnomalies,
  translateBatch,
} from "causal-order"

const translated = translateBatch(records, config)
const translationSummary = summarizeTranslationAnomalies(translated.anomalies)

const ordered = orderEvents(translated.translated, {
  strict: false,
  detectAnomalies: true,
})

const inspection = inspectOrderResult(ordered)

console.log(translationSummary)
console.log(inspection)
```

The `0.8.0` helper layer is intentionally narrow:

* `summarizeEventAnomalies()`
* `summarizeTranslationAnomalies()`
* `explainOrderedEvent()`
* `inspectOrderResult()`
* `inspectOrderBatch()`

These helpers summarize or explain existing package output. They do not hide anomalies, rewrite ordered state, or invent stronger causal claims than the runtime already supports.

## Streaming Overview

For large or unbounded event flows, use `orderEventStream()` instead of assuming everything belongs in one in-memory batch.

That includes both ordinary day-to-day stream processing and delayed reconnect, offline sync, or recovery flows where late arrivals are part of normal operations.

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

* [Streaming Recovery And Resync](https://causal-order.gazali.one/guides/streaming-recovery-resync/)
* [Streaming Finality](https://causal-order.gazali.one/wiki/streaming-finality/)

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

## Get Started

Evaluate the package:

* start with [What This Library Is](https://causal-order.gazali.one/wiki/what-this-library-is/)
* read [Quick Start Scenarios](https://causal-order.gazali.one/guides/quick-start-scenarios/)
* check [Supported Vs Unsupported Usage](https://causal-order.gazali.one/guides/supported-vs-unsupported-usage/)
* scan [Examples And Entrypoints](https://causal-order.gazali.one/guides/examples-and-entrypoints/)

Build a first flow:

* start with [Package Surface Overview](https://causal-order.gazali.one/guides/package-surface-overview/)
* use [Policy Guidance](https://causal-order.gazali.one/guides/policy-guidance/) to choose strictness and late-arrival behavior
* keep [Upgrade Expectations](https://causal-order.gazali.one/guides/upgrade-expectations/) nearby if you are adopting it into a maintained system
* use [Mental Model](https://causal-order.gazali.one/guides/mental-model/) and [Clocks, Causality, And Why HLC](https://causal-order.gazali.one/guides/clocks-causality-and-why-hlc/) when you need deeper design context

Operate or debug a deployed workflow:

* use [Replay Inspection Workflow](https://causal-order.gazali.one/guides/operations/replay-inspection-workflow/)
* use [Streaming Reconciliation Workflow](https://causal-order.gazali.one/guides/operations/streaming-reconciliation-workflow/)
* use [Operator Metrics Guide](https://causal-order.gazali.one/guides/operations/operator-metrics-guide/)
* use [Streaming Recovery And Resync](https://causal-order.gazali.one/guides/streaming-recovery-resync/) and [Streaming Finality](https://causal-order.gazali.one/wiki/streaming-finality/) for stream-specific behavior

Study failure patterns and workloads:

* [Case Studies](https://causal-order.gazali.one/guides/case-studies/)
* [Replay Corruption](https://causal-order.gazali.one/guides/replay-corruption/)
* [Multi-Region Drift](https://causal-order.gazali.one/guides/multi-region-drift/)
* [False Audit Timelines](https://causal-order.gazali.one/guides/false-audit-timeline/)
* [Offline Sync Anomalies](https://causal-order.gazali.one/guides/offline-sync-anomalies/)
* [Causal Inversion](https://causal-order.gazali.one/guides/causal-inversion/)
* [AWS-Inspired DynamoDB Outage Exercise](https://causal-order.gazali.one/guides/aws-inspired-dynamodb-outage/)
* [Stress Hardening](https://causal-order.gazali.one/guides/stress-hardening/)
* [After-Hours Batch Processing](https://causal-order.gazali.one/guides/after-hours-batch-processing/)
* [Realistic Workloads](https://causal-order.gazali.one/wiki/realistic-workloads/)

Runnable examples:

* [Examples Index](https://causal-order.gazali.one/examples/)
* [Minimal Ingress Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/ingress-minimal.mjs)
* [Ingress Replay Pipeline Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/ingress-replay-pipeline.mjs)
* [Local Durable Buffer Replay Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/local-durable-buffer-replay.mjs)
* [False Audit Timeline Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/false-audit-timeline.mjs)
* [Offline Sync Anomalies Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/offline-sync-anomalies.mjs)
* [Streaming Recovery And Resync Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/streaming-recovery-resync.mjs)

The runnable examples are written from the package consumer point of view.
They use the public `causal-order` package surface so copied example code still looks like the right starting point in a real project.

Repo-only reference material:

* [Production Gate](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/production-gate-0.3.2.md)
* [Streaming Hardening Implementation Notes](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/implementation-guide-0.3.3.md)
* [Runtime Stability Implementation Notes](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/implementation-guide-0.3.4.md)
* [Stability Implementation Guide](https://github.com/GazaliAhmad/causal-order/blob/main/guides/stability/implementation-guide-0.5.0.md)
* [Release Notes `0.7.0`](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/0.7.0.md)
* [ROADMAP `0.8.0`](https://github.com/GazaliAhmad/causal-order/blob/main/ROADMAP.md)
* [MAINTENANCE.md](https://github.com/GazaliAhmad/causal-order/blob/main/MAINTENANCE.md)
* [RELEASE_PROCESS.md](https://github.com/GazaliAhmad/causal-order/blob/main/RELEASE_PROCESS.md)
* [COMPATIBILITY.md](https://github.com/GazaliAhmad/causal-order/blob/main/COMPATIBILITY.md)

## Status

`causal-order` is published at `0.7.0`, and the current docs line is being carried forward as `0.8.0`.

Current package posture:

* bounded batch recovery, replay, reconciliation, and audit-style workloads remain the stronger production-credible side of the current contract
* streaming remains part of the public contract, with the current hardening and runtime-stability guides defining the proof base the project is willing to defend
* raw-record translation into the event envelope and its machine-readable failure contract are now part of the package surface rather than repo-local work

The current `0.8.0` docs line adds:

* a clearer maintainer, compatibility, upgrade, and discovery layer on top of the published `0.7.0` package surface
* focused subpaths that read more clearly as the primary API story for new code
* `1.0.0` is the point where the semantic contract should feel stable enough to preserve long-term

For the `0.8.0` operational decision layer, see:

* [Policy Guidance](https://causal-order.gazali.one/guides/policy-guidance/)
* [Replay Inspection Workflow](https://causal-order.gazali.one/guides/operations/replay-inspection-workflow/)
* [Streaming Reconciliation Workflow](https://causal-order.gazali.one/guides/operations/streaming-reconciliation-workflow/)
* [Operator Metrics Guide](https://causal-order.gazali.one/guides/operations/operator-metrics-guide/)

## Repository Development

If you are working in the repository itself, start with:

* [CONTRIBUTING.md](https://github.com/GazaliAhmad/causal-order/blob/main/CONTRIBUTING.md)
* [MAINTENANCE.md](https://github.com/GazaliAhmad/causal-order/blob/main/MAINTENANCE.md)
* [RELEASE_PROCESS.md](https://github.com/GazaliAhmad/causal-order/blob/main/RELEASE_PROCESS.md)

The most useful local gates are:

```bash
npm run check
npm test
npm run release:check
```

## License

MIT. See [LICENSE](https://github.com/GazaliAhmad/causal-order/blob/main/LICENSE).

## Security

See [SECURITY.md](https://github.com/GazaliAhmad/causal-order/blob/main/SECURITY.md) for supported versions and private vulnerability reporting guidance.

## Contributing

See [CONTRIBUTING.md](https://github.com/GazaliAhmad/causal-order/blob/main/CONTRIBUTING.md) for repository workflow, verification expectations, and documentation update guidance.
