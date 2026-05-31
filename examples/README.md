# Examples

These examples are runnable starting points for understanding how to use `causal-order` by workload shape.

They are meant to answer:

* which example should I run first?
* which package entrypoint does that example demonstrate?
* what kind of operational problem is this example helping me evaluate?

If you want the package-facing guide version of that chooser, see:

* [Examples And Entrypoints](../guides/examples-and-entrypoints.md)
* [Quick Start Scenarios](../guides/quick-start-scenarios.md)

## Choose A First Example

Start with the scenario that looks closest to your real workload:

* raw ingress into ordering:
  * `examples/ingress-minimal.mjs`
* replay, duplicates, and rejected raw rows:
  * `examples/ingress-replay-pipeline.mjs`
* local durable replay and inspection:
  * `examples/local-durable-buffer-replay.mjs`
* audit reconstruction:
  * `examples/false-audit-timeline.mjs`
* cross-region or cross-service causal ambiguity:
  * `examples/multi-region-drift.mjs`
  * `examples/causal-inversion.mjs`
* offline sync backlog inspection:
  * `examples/offline-sync-anomalies.mjs`
* reconnect-heavy stream correction:
  * `examples/streaming-recovery-resync.mjs`

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

## What The Main Example Groups Show

### Ingress examples

These show:

* the real `translateBatch()` to `orderEvents()` path
* translated-versus-rejected record visibility
* a runnable starting point for the published ingress contract

### Replay and inspection example

This shows:

* local durable JSONL buffering before replay
* replay inspection via `inspectOrderResult()`
* a package-facing example of bounded replay review before downstream writeback

### Failure-mode and streaming examples

These show:

* naive clock-order comparisons where they help
* confidence labels
* causal evidence where available
* reconnect/resync behavior
* late-arrival correction batches
* a concrete `orderEventStream()` operational slice

## Which Entrypoints These Examples Exercise

The examples mainly exercise:

* `translateBatch()`
* `orderEvents()`
* `orderEventStream()`
* `inspectOrderResult()`

For pairwise helper usage outside the runnable scenario files, prefer:

```ts
import { compareByHlc, compareDeterministically } from "causal-order"
```

If you want the larger-batch follow-through beyond these small examples, see the [Stress Hardening guide](../guides/stress-hardening.md).
