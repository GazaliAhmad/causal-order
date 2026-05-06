# causal-order

`causal-order` is an event integrity library for distributed systems.

It helps developers order what can be ordered, group what is concurrent, flag what is suspicious, and refuse false certainty.

This is not a general time library.
It is a library for working with distributed event timelines when wall-clock timestamps are not enough.

## Status

The project is intended to mature through `0.x` releases before a stable npm release.

Current version: `0.0.4`

During `0.x`:

* the API is expected to evolve
* examples and semantics matter more than surface stability
* the goal is to prove the model before publishing `1.0.0`

Planned release posture:

* `0.x`: testing, iteration, API refinement
* `1.0.0`: first stable public npm release

## Try It

The fastest way to see the library working today:

```bash
npm install
npm test
npm run demo
npm run examples
```

What those commands do:

* `npm test`: runs the automated unit, streaming, and scenario tests
* `npm run demo`: runs a small focused causal inversion demo
* `npm run examples`: runs the guide-aligned distributed failure-mode examples

## How Developers Use This Library

Developers use `causal-order` when they have events from multiple services, regions, devices, or workers and do not want to lie to themselves by sorting only on timestamps.

Typical workflow:

1. Generate or ingest event clocks.
2. Validate each event.
3. Order events with explicit confidence levels.
4. Inspect anomalies and concurrent groups instead of forcing fake order.

In practice, this library is useful for:

* audit timeline reconstruction
* replay pipelines
* multi-region debugging
* offline sync inspection
* late-arrival stream handling
* distributed incident analysis

What developers get back is not just a sorted list.
They get a safer interpretation of the timeline:

* `proven`: explicit causal evidence exists
* `derived`: order was inferred from HLC, sequence, or ingestion metadata
* `fallback`: deterministic tie-breaking was required
* `unknown`: the library cannot justify a reliable order

That means the result can say:

* this event is safely before that one
* these two events are concurrent
* this record has an invalid clock
* this stream result is operationally final, not causally certain

The value is not "we sorted your events."
The value is "we stopped your timeline from pretending to know more than it does."

## Quick Start

The examples below describe the intended `0.x` API shape.
They are designed to show how a developer would use the library once the package surface is available.

### 1. Create clocks when producing events

```ts
import { createHlcClock } from "causal-order"

const clock = createHlcClock({
  nodeId: "api-sg-1",
})

const event = {
  id: "evt-1",
  nodeId: "api-sg-1",
  clock: clock.now(),
  payload: {
    type: "user_created",
    userId: "user-123",
  },
  sequence: 1n,
}
```

This gives each event a Hybrid Logical Clock timestamp that can move forward safely even when wall-clock time is imperfect.

### 2. Validate events before trusting them

```ts
import { validateEvent } from "causal-order"

const result = validateEvent(event)

if (!result.valid) {
  console.error(result.errors)
}
```

Validation is important because bad metadata should become visible, not silently normalized.

### 3. Order events honestly

```ts
import { orderEvents } from "causal-order"

const events = [
  {
    id: "evt-1",
    nodeId: "api-sg-1",
    clock: {
      physicalTimeMs: 1714971840123n,
      logicalCounter: 0,
      nodeId: "api-sg-1",
    },
    payload: { type: "user_created" },
    sequence: 1n,
  },
  {
    id: "evt-2",
    nodeId: "worker-us-1",
    clock: {
      physicalTimeMs: 1714971840125n,
      logicalCounter: 2,
      nodeId: "worker-us-1",
    },
    payload: { type: "email_sent" },
  },
]

const ordered = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})
```

Then inspect the result:

```ts
console.log(ordered.ordered)
console.log(ordered.concurrentGroups)
console.log(ordered.anomalies)
```

Expected shape:

```ts
[
  {
    event: events[0],
    orderIndex: 0n,
    orderBasis: "sequence",
    confidence: "proven",
    causalEvidence: [{ type: "same_node_sequence" }],
  },
  {
    event: events[1],
    orderIndex: 1n,
    orderBasis: "hlc",
    confidence: "derived",
  },
]
```

The important part is the explanation.
The library tells the developer why an order exists and how trustworthy that order is.

### 4. Use streaming mode for large event flows

```ts
import { orderEventStream } from "causal-order"

for await (const batch of orderEventStream(source, {
  windowSizeMs: 60_000n,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "flag",
  strict: false,
})) {
  console.log(batch.events)
  console.log(batch.anomalies)
  console.log(batch.watermark, batch.isFinal)
}
```

This is for large or unbounded streams where the library should use bounded windows instead of pretending it can hold full history forever.

### 5. Understand what the result means

Keep these rules in mind:

* HLC ordering alone is `derived`, not `proven`
* `concurrent` means no known causal relationship exists
* `unknown` means the metadata is too weak or invalid to justify a claim
* stream finality is watermark-based operational confidence, not causal certainty

## Why Not Just Sort By Timestamp?

Because distributed systems produce misleading timelines all the time:

* clocks drift across regions
* replayed events can appear newer than original events
* offline devices sync late
* ingestion order can differ from event creation order
* some events are truly concurrent

Naive timestamp sorting produces a clean-looking answer.
That answer is often false.

`causal-order` exists to make that uncertainty visible instead of hiding it.

## Guides

If you want the deeper mental model and failure modes, start here:

* [Guides Index](./guides/README.md)
* [Mental Model](./guides/mental-model.md)
* [Replay Corruption](./guides/replay-corruption.md)
* [Multi-Region Drift](./guides/multi-region-drift.md)
* [False Audit Timelines](./guides/false-audit-timeline.md)
* [Offline Sync Anomalies](./guides/offline-sync-anomalies.md)
* [Causal Inversion](./guides/causal-inversion.md)

Runnable versions of those guides live in [examples/README.md](./examples/README.md).

## License

MIT. See [LICENSE](./LICENSE).
