# Guides

These guides are the practical, repository-coupled layer of the documentation.
They explain how to use `causal-order`, how the main deployment patterns work, and how the current implementation behaves in real operational shapes.

For the deeper conceptual layer, mental-model pages, and explanatory write-ups that are less tied to operational walkthroughs, see the wiki.

Alongside the current ordering and streaming surfaces, the published `0.4.1` line covers both the narrow raw-record ingress path via `translateBatch()` and its machine-readable diagnostics follow-through.
The current `0.4.2` follow-through work makes that ingress contract easier to evaluate through runnable package-facing examples and tighter docs synchronization.
For that contract, start with the developer-experience guide, the `0.4.2` implementation note, the README's raw-record translation example, and the runnable ingress examples under `/examples`.

Start here:

* [Mental Model](./mental-model.md)
* [Notation And Runtime Contract](./notation-and-runtime-contract.md)
* [How Order Is Written](./how-order-is-written.md)
* [Clocks, Causality, And Why HLC](./clocks-causality-and-why-hlc.md)
* [Case Studies](./case-studies.md)
* [Stress Hardening](./stress-hardening.md)
* [After-Hours Batch Processing](./after-hours-batch-processing.md)
* [Streaming Recovery And Resync](./streaming-recovery-resync.md)

Workloads and hardening:

* [Anomaly Surface Audit](./hardening/anomaly-surface-0.3.2.md)
* [Fuzz Testing](./hardening/fuzz-testing-0.3.2.md)
* [Streaming Hardening And Pressure](./hardening/streaming-hardening-0.3.3.md)
* [Runtime Stability](./hardening/runtime-stability-0.3.4.md)

Developer experience:

* [Developer Experience](./devex/developer-experience-0.4.0.md)
* [Implementation Guide `0.4.1`](./devex/implementation-guide-0.4.1.md)
* [Implementation Guide `0.4.2`](./devex/implementation-guide-0.4.2.md)

Runnable examples:

* [Examples Index](../examples/README.md)
* [Minimal Ingress Example](../examples/ingress-minimal.mjs)
* [Ingress Replay Pipeline Example](../examples/ingress-replay-pipeline.mjs)
* [Streaming Recovery Resync Example](../examples/streaming-recovery-resync.mjs)

Failure-mode guides:

* [Replay Corruption](./replay-corruption.md)
* [Multi-Region Drift](./multi-region-drift.md)
* [False Audit Timelines](./false-audit-timeline.md)
* [Offline Sync Anomalies](./offline-sync-anomalies.md)
* [Causal Inversion](./causal-inversion.md)

The point of this section is not only to explain the API.
It is to show why the API exists.
