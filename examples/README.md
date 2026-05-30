# Examples

These examples are runnable counterparts to the failure-mode guides.
They are also the human-sized semantic seeds for the larger corrupted-dataset stress profiles used in `0.2.2` hardening work.

Run all examples:

```bash
npm run examples
```

Run the smoke demo:

```bash
npm run demo
```

Run one ingress example directly:

```bash
npm run build
node examples/ingress-minimal.mjs
node examples/ingress-replay-pipeline.mjs
node examples/local-durable-buffer-replay.mjs
```

Run one failure-mode example directly:

```bash
npm run build
node examples/replay-corruption.mjs
node examples/multi-region-drift.mjs
node examples/false-audit-timeline.mjs
node examples/offline-sync-anomalies.mjs
node examples/streaming-recovery-resync.mjs
node examples/causal-inversion.mjs
```

Run the benchmark example directly:

```bash
npm run build
node examples/benchmark.mjs 100000
```

Each example shows:

* either the raw-record ingress path or a failure-mode ordering story
* the `causal-order` interpretation
* anomalies when data or timelines are suspicious

The ingress examples add:

* the real `translateBatch()` to `orderEvents()` path
* translated-versus-rejected record visibility
* a runnable starting point for the published ingress contract

The first integration-shaped example adds:

* local durable JSONL buffering before replay
* replay inspection via `inspectOrderResult()`
* a package-facing example of bounded replay review before downstream writeback

The failure-mode and streaming examples add:

* naive clock-order comparisons where they help
* confidence labels
* causal evidence where available

For pairwise helper usage outside the runnable scenario files, prefer:

```ts
import { compareByHlc, compareDeterministically } from "causal-order"
```

The streaming recovery example adds:

* reconnect/resync behavior
* late-arrival correction batches
* a concrete `orderEventStream()` operational slice

If you want the larger-batch follow-through beyond these small examples, see the [Stress Hardening guide](../guides/stress-hardening.md).
