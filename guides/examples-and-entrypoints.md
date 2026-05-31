# Examples And Entrypoints

This guide helps you choose the right first example and the right package entrypoint without reading the whole repo first.

If you are evaluating `causal-order`, the fastest path is:

1. choose the example that matches your workload
2. use the narrowest entrypoint that matches that workload
3. read the follow-through guide only after the example output makes sense

## Start With The Simplest Matching Example

Use this table as the first chooser:

| If you need to evaluate... | Start here | Main entrypoint |
| --- | --- | --- |
| raw records becoming ordered envelopes | `examples/ingress-minimal.mjs` | `translateBatch()` then `orderEvents()` |
| replay or reprocessing with duplicates and corruption visibility | `examples/ingress-replay-pipeline.mjs` | `translateBatch()` then `orderEvents()` |
| local durable replay before downstream writeback | `examples/local-durable-buffer-replay.mjs` | `translateBatch()`, `orderEvents()`, `inspectOrderResult()` |
| audit reconstruction where timestamp order looks believable but wrong | `examples/false-audit-timeline.mjs` | `orderEvents()` |
| cross-region or cross-service causal ambiguity | `examples/multi-region-drift.mjs` | `orderEvents()` |
| explicit parent-child inversion against clock appearance | `examples/causal-inversion.mjs` | `orderEvents()` |
| offline sync backlog inspection | `examples/offline-sync-anomalies.mjs` | `orderEvents()` |
| reconnect-heavy late-arrival stream correction | `examples/streaming-recovery-resync.mjs` | `orderEventStream()` |

## Entrypoint Quick Map

The package is easier to use if you pick the entrypoint that matches your input shape.

### `translateBatch()`

Use this first when your data is not already in the event-envelope shape.

Choose it when:

* your source records come from exports, queue payloads, or application objects
* you need timestamp coercion, field mapping, or translation anomalies
* you want raw-record rejection to stay visible instead of being hidden in adapter glue

### `orderEvents()`

Use this for bounded finite sets.

Choose it when:

* you are reconstructing a replay, audit, or recovery slice
* you want one batch result with ordered output, anomalies, and stats
* late-arrival correction is not the main operating model

### `orderEventStream()`

Use this when events keep arriving and lateness is part of the real workflow.

Choose it when:

* reconnects, delayed sync, or correction windows are normal
* you need watermark-aware batch emission
* finality is operational and may require later reconciliation

### Inspection helpers

Use these after you already have ordering output and want operator-facing summaries:

* `inspectOrderResult()`
* `inspectOrderBatch()`
* `summarizeEventAnomalies()`
* `summarizeTranslationAnomalies()`
* `explainOrderedEvent()`

Choose them when:

* you need a compact replay or audit review layer
* you want summaries without building your own result-shaping layer first
* you need operator-facing wording rather than only raw anomaly arrays

## Recommended First Commands

If you are evaluating batch ingress and ordering:

```bash
npm run build
node examples/ingress-minimal.mjs
node examples/ingress-replay-pipeline.mjs
```

If you are evaluating replay review:

```bash
npm run build
node examples/local-durable-buffer-replay.mjs
node examples/replay-corruption.mjs
```

If you are evaluating streaming or reconnect behavior:

```bash
npm run build
node examples/offline-sync-anomalies.mjs
node examples/streaming-recovery-resync.mjs
```

## When To Prefer Focused Imports

The top-level package import is the simplest path:

```ts
import { orderEvents, orderEventStream, translateBatch } from "causal-order"
```

Use focused subpath imports when you already know you want a narrower entrypoint shape:

```ts
import { orderEvents } from "causal-order/order"
import { orderEventStream } from "causal-order/stream"
import { translateBatch } from "causal-order/translate"
```

That is mostly about clarity and narrower imports, not about changing semantics.

The current package boundary is also intentional:

* the root `causal-order` import may still carry compatibility aliases for older code
* focused subpaths are the cleaner primary surface for new code and do not need to preserve every deprecated alias forever

## What To Read Next

After running an example, continue with the closest follow-through guide:

* replay or corruption: [Replay Inspection Workflow](./operations/replay-inspection-workflow.md)
* streaming reconciliation: [Streaming Reconciliation Workflow](./operations/streaming-reconciliation-workflow.md)
* operational policy choices: [Policy Guidance](./policy-guidance.md)
* support boundary questions: [Supported Vs Unsupported Usage](./supported-vs-unsupported-usage.md)
* upgrade caution before changing versions: [Upgrade Expectations](./upgrade-expectations.md)
