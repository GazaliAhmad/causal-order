# causal-order

Order distributed events without pretending timestamps prove more than they do. `causal-order` combines explicit causal evidence, same-node sequence, hybrid logical clocks, deterministic fallback, and structured anomalies into a deployable ordering runtime.

Published package version: `v1.0.1`

## Stack Position

```text
@causal-order/transport -> [@causal-order/monitor] -> @causal-order/dedupe -> causal-order
```

`causal-order` owns ordering, confidence, causal evidence, and anomaly output at the end of the delivery path. Monitor is optional and owns health-aware buffering and replay. `@causal-order/testing` sits outside the path as qualification infrastructure, not a fifth runtime stage.

## Install and Requirements

```bash
npm install causal-order
```

- Node.js `>=22.13.0`
- ESM-only output
- no runtime dependencies

The repository and published stack are validated on Node.js `22` and `24`. The `22.13.0` floor aligns core with monitor's built-in `node:sqlite` requirement. See the [`1.0.1` release notes](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/1.0.1.md) for the exact qualified companion versions.

## When to Use It

Use `causal-order` when:

- events arrive from several services, devices, or regions
- timestamps alone cannot establish causal truth
- replay, reconnect, or late arrival can disturb arrival order
- operators need an explanation for ordering decisions
- invalid or uncertain metadata must remain visible

### When Not to Use It

This package is not:

- a distributed queue, transport, or persistence layer
- a semantic dedupe or domain-conflict resolver
- a replacement for consensus ordering already established by Raft, Paxos, or an equivalent authority
- necessary when a plain timestamp sort is genuinely sufficient

## Quick Start

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

const result = orderEvents(events)

console.log(result.ordered)
console.log(result.anomalies)
```

Each ordered entry explains its position with `orderBasis`, `confidence`, and any `causalEvidence`. The runtime does not silently upgrade a clock-derived or fallback order into proven causality.

## Core Behavior

Ordering evidence is applied in this direction:

```text
explicit dependencies -> same-node sequence -> HLC -> deterministic fallback
```

Confidence remains visible:

- `proven`: supported by explicit causal or same-node evidence
- `derived`: inferred from valid ordering metadata such as HLC or initial sequence placement
- `fallback`: stable placement without a stronger causal claim
- `unknown`: the relationship remains unresolved

The default batch posture is warning-visible:

```ts
orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})
```

`strict` controls fail-fast behavior. `detectAnomalies` controls diagnostic output. `allowUnknownOrder` controls unresolved-order severity; it does not invent stronger certainty.

## Raw Record Translation

Use `translateBatch()` when source records do not already match the event envelope:

```ts
import { orderEvents, translateBatch } from "causal-order"

const translated = translateBatch(records, {
  getEventId: (record) => record.eventId,
  getNodeId: (record) => record.source,
  getPhysicalTime: (record) => record.occurredAt,
  getSequence: (record) => record.sequence,
  getParentEventId: (record) => record.parent,
  getPayload: (record) => record.body,
})

const result = orderEvents(translated.translated)
```

Translation separates accepted events from structured anomalies. The [policy guide](https://causal-order.gazali.one/guides/policy-guidance/) covers coercion and failure behavior.

## Streaming

Use `orderEventStream()` for large or unbounded flows:

```ts
import { orderEventStream } from "causal-order/stream"

for await (const batch of orderEventStream(source(), {
  batchSize: 100,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "flag",
})) {
  console.log(batch.events, batch.anomalies)
}
```

Watermarks control operational readiness, not causal truth. Late arrivals use explicit `flag`, `drop`, `emit_correction`, or `fail` policy.

## Inspection

Inspection helpers summarize existing output without rewriting it:

```ts
import {
  explainOrderedEvent,
  inspectOrderBatch,
  inspectOrderResult,
  summarizeEventAnomalies,
  summarizeTranslationAnomalies,
} from "causal-order/inspect"
```

## Package Exports

| Export | Purpose |
| --- | --- |
| `causal-order` | primary ordering, translation, validation, and inspection surface |
| `causal-order/batch` | batch ordering |
| `causal-order/stream` | streaming ordering |
| `causal-order/translate` | raw-record translation |
| `causal-order/clock` | HLC creation and serialization |
| `causal-order/compare` | causal, HLC, and deterministic comparison |
| `causal-order/validate` | event and clock validation |
| `causal-order/anomalies` | anomaly detection |
| `causal-order/inspect` | output explanation and summaries |
| `causal-order/watermarks` | stream watermark helpers |
| `causal-order/types` | public TypeScript contracts |

## Documentation

- [Website and API reference](https://causal-order.gazali.one)
- [Quick-start scenarios](https://causal-order.gazali.one/guides/quick-start-scenarios/)
- [Package surface overview](https://causal-order.gazali.one/guides/package-surface-overview/)
- [Supported and unsupported usage](https://causal-order.gazali.one/guides/supported-vs-unsupported-usage/)
- [Policy guidance](https://causal-order.gazali.one/guides/policy-guidance/)
- [Extension boundary](https://causal-order.gazali.one/guides/extension-boundary-guide/)
- [Replay inspection workflow](https://causal-order.gazali.one/guides/operations/replay-inspection-workflow/)
- [Streaming reconciliation workflow](https://causal-order.gazali.one/guides/operations/streaming-reconciliation-workflow/)
- [Examples](https://github.com/GazaliAhmad/causal-order/tree/main/examples)
- [`1.0.1` release notes](https://github.com/GazaliAhmad/causal-order/blob/main/docs/releases/1.0.1.md)
- [Changelog](https://github.com/GazaliAhmad/causal-order/blob/main/CHANGELOG.md)

Detailed concepts, operational workflows, case studies, and release history stay in `guides/`, `wiki/`, and `docs/releases/` rather than being repeated here.

## Repository Development

```bash
npm run check
npm test
npm run release:check
```

See [CONTRIBUTING.md](https://github.com/GazaliAhmad/causal-order/blob/main/CONTRIBUTING.md), [MAINTENANCE.md](https://github.com/GazaliAhmad/causal-order/blob/main/MAINTENANCE.md), and [RELEASE_PROCESS.md](https://github.com/GazaliAhmad/causal-order/blob/main/RELEASE_PROCESS.md).

## License

[MIT](https://github.com/GazaliAhmad/causal-order/blob/main/LICENSE)

## Security

See [SECURITY.md](https://github.com/GazaliAhmad/causal-order/blob/main/SECURITY.md) for supported versions and private vulnerability reporting.
