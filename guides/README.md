# Guides

These guides are the practical, repository-coupled layer of the documentation.
They explain how to use `causal-order`, how the main deployment patterns work, and how the current implementation behaves in real operational shapes.

For the deeper conceptual layer, mental-model pages, and explanatory write-ups that are less tied to operational walkthroughs, see the wiki.

Start here:

* [Mental Model](./mental-model.md)
* [Clocks, Causality, And Why HLC](./clocks-causality-and-why-hlc.md)
* [Production Gate `0.3.2`](./production-gate-0.3.2.md)
* [Anomaly Surface Audit `0.3.2`](./anomaly-surface-0.3.2.md)
* [Case Studies](./case-studies.md)
* [Stress Hardening](./stress-hardening.md)
* [After-Hours Batch Processing](./after-hours-batch-processing.md)
* [Streaming Recovery And Resync](./streaming-recovery-resync.md)

Failure-mode guides:

* [Replay Corruption](./replay-corruption.md)
* [Multi-Region Drift](./multi-region-drift.md)
* [False Audit Timelines](./false-audit-timeline.md)
* [Offline Sync Anomalies](./offline-sync-anomalies.md)
* [Causal Inversion](./causal-inversion.md)

The point of this section is not only to explain the API.
It is to show why the API exists.
