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

* a naive clock-based story
* the `causal-order` interpretation
* confidence labels
* causal evidence where available
* anomalies when the timeline is suspicious

The streaming recovery example adds:

* reconnect/resync behavior
* late-arrival correction batches
* a concrete `orderEventStream()` operational slice

If you want the larger-batch follow-through beyond these small examples, see the [Stress Hardening guide](../guides/stress-hardening.md).
