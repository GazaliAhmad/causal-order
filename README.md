# causal-order

<table border="0" cellpadding="0" cellspacing="0" style="border:none; border-collapse:collapse; margin-bottom:10px;">
  <tr style="border:none;">
    <td style="border:none; padding-right:8px;"><a href="https://github.com/GazaliAhmad/causal-order/actions"><img src="https://img.shields.io/github/actions/workflow/status/GazaliAhmad/causal-order/ci.yml?branch=main&style=flat-square&label=CI&color=blue&badgev=20260529" alt="CI Status"></a></td>
    <td style="border:none; padding-right:8px;"><a href="https://github.com/GazaliAhmad/causal-order"><img src="https://img.shields.io/badge/Dependencies-0%20%2F%20Zero-black?style=flat-square" alt="Zero Dependencies Unified"></a></td>
    <td style="border:none; padding-right:8px;"><a href="https://bundlephobia.com/package/causal-order"><img src="https://img.shields.io/badge/minified-7.4%20kB-blue?style=flat-square" alt="Bundle Size Minified"></a></td>
    <td style="border:none; padding-right:8px;"><a href="https://github.com/GazaliAhmad/causal-order"><img src="https://img.shields.io/badge/Node.js-v24%20LTS%20Ready-green?style=flat-square" alt="Node Runtime"></a></td>
    <td style="border:none; padding:0;"><a href="https://github.com/GazaliAhmad/causal-order"><img src="https://img.shields.io/badge/150k%20Stress%20Profile-Passed%20%E2%9C%93-orange?style=flat-square" alt="Stress Profile"></a></td>
  </tr>
</table>

![causal-order banner](https://causal-order.gazali.one/readme-banner.svg)

An event integrity library for distributed systems that still use clocks, but cannot rely on one globally synchronized clock as the truth model.

`causal-order` helps developers design and run event processing, replay, and recovery flows without assuming the system has one perfect global time source.

It does not replace clocks or timestamps.
It helps when timestamp order alone is not enough to explain what happened.

Website:

* [https://causal-order.gazali.one](https://causal-order.gazali.one)

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

A timestamp-only sort produces a clean-looking answer.
In distributed systems, clean-looking timestamp order is often not the same as causal truth.

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

* ESM only

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

### Development Environment

Primary active development targets Node.js `24`.

Internal profiling, benchmarking, local tooling, and performance validation workflows are optimized against the latest stable Node.js runtime.

---

### Minimum Supported Runtime

The published npm package declares:

```text
Node.js >=20
```

as the official supported runtime floor.

Public package behavior, exported APIs, and example integrations must remain fully functional under Node.js 20 without requiring runtime feature flags or polyfills.

No runtime-specific capabilities requiring versions newer than Node.js 20 may be introduced into the public package surface without a formal major-version compatibility review.

---

### CI Compatibility Matrix

Continuous Integration validation executes against:

* Node.js `18`
* Node.js `20`
* Node.js `24`

Purpose by runtime tier:

| Runtime | Role |
| --- | --- |
| Node.js 18 | Legacy compatibility regression detection |
| Node.js 20 | Official supported runtime floor |
| Node.js 24 | Active development and performance validation |

---

### Compatibility Contract Clarification

Node.js 18 compatibility is treated as best-effort regression validation rather than a guaranteed long-term support contract.

The project's formal runtime support boundary begins at:

```text
Node.js >=20
```

Successful execution under Node.js 18 should not be interpreted as a permanent stability guarantee across future release lines.

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

As of `0.5.0`, these are the preferred names for:

* direct HLC comparison: `compareByHlc()`
* deterministic fallback comparison: `compareDeterministically()`

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

Current ingress contract highlights:

* required mappers: `getEventId`, `getNodeId`, `getPhysicalTime`
* accepted timestamp inputs: `bigint`, safe integer `number`, or canonical integer `string`
* rejected timestamp inputs include `Date`, ISO timestamp strings, decimals, exponent notation, and unsafe integers
* translated results split accepted records from structured translation anomalies
* the returned envelope shell is shallowly frozen, while `payload` stays by reference

Ingestion design rules:

* pass original source records into `translateBatch()` whenever possible
* keep pre-translation shaping narrow and cheap rather than building per-record "almost-envelope" wrappers
* let `translateBatch()` own coercion, rejection, and anomaly reporting instead of hiding those rules in ad hoc adapter code
* avoid broad cloning or repeated metadata copying before translation unless a real upstream constraint requires it
* if a wrapper layer can be removed without losing anything except convenience, it is probably the wrong layer to keep

### Translation Policy Surface

Ingress policy choices are explicit and stay separate from `orderEvents()` strictness:

```ts
const translated = translateBatch(records, {
  getEventId: (record) => record.eventId,
  getNodeId: (record) => record.source,
  getPhysicalTime: (record) => record.occurredAt,
  getPayload: (record) => record.body,
  policy: {
    recordFailure: "warn",
    optionalFieldFailure: "warn",
  },
})
```

Current policy syntax:

* `recordFailure: "warn" | "fail"`
* `optionalFieldFailure: "warn" | "continue" | "fail"`

Policy meanings:

* `"warn"`
  reject the affected record or field path, keep the problem visible as a structured translation anomaly, and continue processing the batch
* `"continue"`
  only for optional-field failures; omit the rejected optional value, keep the translated event moving, and still emit the anomaly so the omission is operator-visible
* `"fail"`
  stop immediately by throwing `TranslateBatchPolicyError`

If you are unsure, keep the default warning-visible posture first.
Choose `"continue"` only when omission is genuinely acceptable, and choose `"fail"` only when the ingress contract should reject the batch immediately.

## Streaming Overview

For large or unbounded event flows, use `orderEventStream()` instead of assuming everything belongs in one in-memory batch.

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
* [Quick Start Scenarios](https://github.com/GazaliAhmad/causal-order/blob/main/guides/quick-start-scenarios.md)
* [Policy Guidance](https://github.com/GazaliAhmad/causal-order/blob/main/guides/policy-guidance.md)
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
* [AWS-Inspired DynamoDB Outage Exercise](https://github.com/GazaliAhmad/causal-order/blob/main/guides/aws-inspired-dynamodb-outage.md)

Workloads and hardening:

* [Production Gate `0.3.2`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/production-gate-0.3.2.md)
* [Anomaly Surface Audit `0.3.2`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/anomaly-surface-0.3.2.md)
* [Fuzz Testing `0.3.2`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/fuzz-testing-0.3.2.md)
* [Streaming Hardening And Pressure `0.3.3`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/streaming-hardening-0.3.3.md)
* [Implementation Guide `0.3.3`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/implementation-guide-0.3.3.md)
* [Runtime Stability 0.3.4](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/runtime-stability-0.3.4.md)
* [Implementation Guide 0.3.4](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/implementation-guide-0.3.4.md)

Published developer-experience docs:

* [Developer Experience `0.4.0`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/devex/developer-experience-0.4.0.md)
* [Implementation Guide `0.4.0`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/devex/implementation-guide-0.4.0.md)
* [Implementation Guide `0.4.1`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/devex/implementation-guide-0.4.1.md)
* [Release Notes `0.4.1`](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/0.4.1.md)

Continuing follow-through notes:

* [Implementation Guide `0.4.2`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/devex/implementation-guide-0.4.2.md)
* [Release Notes `0.4.2`](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/0.4.2.md)

Published stability release:

* [Implementation Guide `0.5.0`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/stability/implementation-guide-0.5.0.md)
* [Release Notes `0.5.0`](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/0.5.0.md)

Additional operational reading:

* [Stress Hardening](https://github.com/GazaliAhmad/causal-order/blob/main/guides/stress-hardening.md)
* [After-Hours Batch Processing](https://github.com/GazaliAhmad/causal-order/blob/main/guides/after-hours-batch-processing.md)
* [Realistic Workloads](https://github.com/GazaliAhmad/causal-order/wiki/Realistic-Workloads)

The `0.3.2` hardening story is now explicit:

* production-gate criteria define what the current contract must prove
* anomaly-surface notes explain what the runtime can and cannot currently signal
* seeded fuzz coverage pressure-tests outage, replay, reconnect, duplicate, and clock-noise cases reproducibly
* bounded batch recovery, replay, and audit-style workloads are the stronger current deployment story within the existing contract
* the larger remaining proof bar is on long-running streaming behavior rather than on bounded batch ordering

Runnable examples:

* [Examples Index](https://github.com/GazaliAhmad/causal-order/blob/main/examples/README.md)
* [Minimal Ingress Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/ingress-minimal.mjs)
* [Ingress Replay Pipeline Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/ingress-replay-pipeline.mjs)
* [False Audit Timeline Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/false-audit-timeline.mjs)
* [Offline Sync Anomalies Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/offline-sync-anomalies.mjs)
* [Streaming Recovery And Resync Example](https://github.com/GazaliAhmad/causal-order/blob/main/examples/streaming-recovery-resync.mjs)

The runnable examples are written from the package consumer point of view.
They use the public `causal-order` package surface so copied example code still looks like the right starting point in a real project.

## Status

`causal-order` is published at `0.5.0`.
The active repository implementation line is now `0.6.x`.

`0.5.0` release shape:

* `0.3.2` established the current production-gate hardening baseline
* `0.3.3` broadened the streaming hardening and pressure release story after that production-gate milestone
* `0.3.4` hardened prolonged and constrained-runtime streaming stability
* `0.4.0` adds the first narrow raw-record ingress contract through `translateBatch()`
* `0.4.1` makes translation diagnostics safer to inspect and control without widening the ingress boundary
* `0.4.2` makes that same package surface easier to evaluate through runnable ingress examples, package-facing policy guidance, and docs synchronization enforcement
* `0.5.0` turns the next line into a published stability-and-contract-design release with explicit migration notes and payload-agnostic core-boundary decisions

For the current operational decision layer, see:

* [Policy Guidance](https://github.com/GazaliAhmad/causal-order/blob/main/guides/policy-guidance.md)
* [Release Notes `0.5.0`](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/0.5.0.md)

`0.5.0` is centered on:

* the existing `0.3.x` hardening and runtime-stability foundation
* a top-level synchronous raw-record ingress surface via `translateBatch()`
* explicit mapper rules for required and optional fields
* deterministic timestamp coercion for accepted primitive inputs
* structured translation anomalies with nested diagnostics, stable classification, and field references
* explicit translation strictness-policy handling
* deterministic diagnostic ordering metadata
* shallow immutability guarantees for translated envelopes with payload preservation by reference
* additive focused subpath exports for narrower package entrypoints
* runnable ingress examples through the real public package surface
* package-facing quick-start and policy guidance for the current contract
* docs synchronization enforcement that keeps examples and top-level docs aligned
* exported-surface review, explicit default-behavior decisions, and published migration notes for the next long-term contract boundary

The released `0.5.0` stability work is centered on:

* exported-surface stability review
* compatibility and migration notes
* explicit core-versus-extension decisions for contradictory events, entity forks, and semantic dedupe across different IDs

For the released stability line, see:

* [Implementation Guide `0.5.0`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/stability/implementation-guide-0.5.0.md)
* [Release Notes `0.5.0`](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/0.5.0.md)

Current deployment posture:

* bounded batch recovery, replay, reconciliation, and audit-style workloads remain the stronger production-credible side of the current contract
* streaming remains part of the public contract, with the earlier hardening and runtime-stability work still defining its current proof base
* raw-record translation into the event envelope and its machine-readable failure contract are now part of the package surface rather than repo-local work

That means:

* the package is usable today
* the API is still evolving, but `0.5.0` makes the intended contract direction much more explicit
* the next implementation line is about tooling and integration depth more than reopening the same `0.5.0` surface questions
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

Current test posture:

* `npm test` includes the direct release-gate suites plus seeded `0.3.2` fuzz coverage
* the fuzz layer currently covers batch outage/replay noise plus streaming reconnect, fragmented watermark-lag, correction-burst, sustained correction-churn, reconnect-burst, bounded-window lagging-watermark, and bounded-memory cross-window replay pressure
* broader exploratory fuzz campaigns are now part of the shipped `0.3.3` pressure expansion

Current benchmark posture:

* `10k` and `100k` are the main enforced guardrail bands
* `150k` corrupted-dataset profiles are available for stress visibility, but are not currently enforced in `npm run bench:check`
* `150k` remains the enforced sustained watermark-lag stream guard band
* a separate non-blocking GitHub Actions post-merge confidence workflow now runs the `150k` batch and `150k` stream validation pair on `main`
* named `250k` batch and stream profiles are already operational extended-validation runs, even though they remain outside the default lightweight `bench:check` guard path
* repeated-cycle, constrained-heap, GC-observed, and sustained correction/reconnect endurance runs are now available as explicit runtime-stability evidence commands
* `npm run bench:profile` is available when you need CPU profiles for the slowest stress cases

## License

MIT. See [LICENSE](https://github.com/GazaliAhmad/causal-order/blob/main/LICENSE).

## Security

See [SECURITY.md](https://github.com/GazaliAhmad/causal-order/blob/main/SECURITY.md) for supported versions and private vulnerability reporting guidance.

## Contributing

See [CONTRIBUTING.md](https://github.com/GazaliAhmad/causal-order/blob/main/CONTRIBUTING.md) for repository workflow, verification expectations, and documentation update guidance.
