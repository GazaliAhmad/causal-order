# Examples

These examples are runnable counterparts to the failure-mode guides.

Run all examples:

```bash
npm run examples
```

Run one example directly:

```bash
npm run build
node examples/replay-corruption.mjs
node examples/multi-region-drift.mjs
node examples/false-audit-timeline.mjs
node examples/offline-sync-anomalies.mjs
node examples/causal-inversion.mjs
```

Each example shows:

* a naive clock-based story
* the `causal-order` interpretation
* confidence labels
* causal evidence where available
* anomalies when the timeline is suspicious
