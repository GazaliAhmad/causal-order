# Quick Start Scenarios

This guide is the fastest package-facing entry point for evaluating `causal-order` by workload shape.

If you are new to the library, do not start by reading every guide in order.
Start with the scenario that looks most like your real problem, run the matching example, and then go deeper only where needed.

The runnable examples are written from the consumer point of view and use the public `causal-order` package surface.
That means copied code should still look like the right starting point in a real project.

## Choose A First Path

### Audit Timeline Reconstruction

Use this path when:

* you are reconstructing who did what and in what order
* a compliance or internal audit export has timestamps from several systems
* a clean total order would be easy to present but hard to justify honestly

Start here:

```bash
npm run build
node examples/false-audit-timeline.mjs
node examples/ingress-minimal.mjs
```

Read next:

* [False Audit Timelines](./false-audit-timeline.md)
* [How Order Is Written](./how-order-is-written.md)

What to look for:

* `proven` versus `derived` conclusions
* explicit dependencies outranking misleading timestamps
* places where the honest answer is weaker than one neat total order

### Replay Pipelines

Use this path when:

* old records can be replayed, re-emitted, or reprocessed later
* duplicates or backfills may look newer than the original causal chain
* you need a bounded batch answer without hiding corruption signals

Start here:

```bash
npm run build
node examples/ingress-replay-pipeline.mjs
node examples/replay-corruption.mjs
```

Read next:

* [Replay Corruption](./replay-corruption.md)
* [After-Hours Batch Processing](./after-hours-batch-processing.md)

What to look for:

* translation anomalies for rejected raw rows
* `duplicate_event` and `causal_inversion`
* replay effects staying visible instead of being silently normalized away

### Distributed Debugging

Use this path when:

* several regions or services disagree about apparent order
* teams keep saying "we sorted by timestamp but it still looks wrong"
* you need to separate correlation from actual causal evidence

Start here:

```bash
npm run build
node examples/multi-region-drift.mjs
node examples/causal-inversion.mjs
```

Read next:

* [Multi-Region Drift](./multi-region-drift.md)
* [Causal Inversion](./causal-inversion.md)
* [Clocks, Causality, And Why HLC](./clocks-causality-and-why-hlc.md)

What to look for:

* cross-node results that remain `derived`
* explicit parent or dependency evidence promoting conclusions to `proven`
* places where believable clocks still do not justify causal truth

### Offline Sync Inspection

Use this path when:

* devices or nodes keep working while disconnected
* ingestion order is different from local creation order
* you need to inspect either a bounded sync backlog or a continuous reconnect flow

Start here for bounded backlog inspection:

```bash
npm run build
node examples/offline-sync-anomalies.mjs
```

Start here for reconnect-heavy streaming inspection:

```bash
npm run build
node examples/streaming-recovery-resync.mjs
```

Read next:

* [Offline Sync Anomalies](./offline-sync-anomalies.md)
* [Streaming Recovery And Resync](./streaming-recovery-resync.md)

What to look for:

* same-node sequence preserving device-local history
* the difference between bounded batch reconstruction and streaming late-arrival handling
* operational visibility for late sync rather than silent flattening

## One Practical Rule

If your input data is not already in the event-envelope shape, start with `translateBatch()` and only then call `orderEvents()`.

If your workload is finite and bounded, start with batch ordering.
If events keep arriving and lateness is part of the operational model, move to `orderEventStream()`.

## Next Step

After you pick a scenario and run the example, the next follow-through guide is:

* [Implementation Guide `0.4.2`](./devex/implementation-guide-0.4.2.md)

That note tracks the remaining `0.4.2` work around policy guidance and docs synchronization.
