# Guides

These guides are the practical, repository-coupled layer of the documentation.
They explain how to use `causal-order`, how the main deployment patterns work, and how the current implementation behaves in real operational shapes.

For the deeper conceptual layer, mental-model pages, and explanatory write-ups that are less tied to operational walkthroughs, see the wiki.

Alongside the current ordering and streaming surfaces, the published `0.5.0` line now includes the narrow raw-record ingress path via `translateBatch()`, its machine-readable diagnostics follow-through, the package-facing DX layer around runnable examples and docs synchronization, and the released stability-and-contract-design pass before `1.0.0`.
The active `0.6.x` line is the next tooling-and-integration pass, built on top of the explicit `0.5.0` core-versus-extension boundary.
For the current published contract, start with the `0.5.0` release notes, the stability implementation guide, the README's raw-record translation example, and the runnable ingress examples under `/examples`.
For helper-level pairwise comparison, prefer `compareByHlc()` and `compareDeterministically()` over compatibility aliases.

Start here:

* [Quick Start Scenarios](./quick-start-scenarios.md)
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
* [Policy Guidance](./policy-guidance.md)
* [Release Notes `0.4.2`](../docs/releases/0.4.2.md)
* [Release Notes `0.5.0`](../docs/releases/0.5.0.md)

Active `0.6.x` line:

* [Implementation Guide `0.6.0`](./operations/implementation-guide-0.6.0.md)

Published stability line:

* [Implementation Guide `0.5.0`](./stability/implementation-guide-0.5.0.md)
* [Exported Surface Inventory `0.5.0`](./stability/exported-surface-inventory-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./stability/decision-record-api-clarity-0.5.0.md)
* [Default-Behavior Compatibility Inventory `0.5.0`](./stability/default-behavior-compatibility-inventory-0.5.0.md)
* [Decision Record: Default Behavior `0.5.0`](./stability/decision-record-default-behavior-0.5.0.md)
* [Domain-Semantic Design Notes `0.5.0`](./stability/domain-semantic-design-notes-0.5.0.md)
* [Decision Record: Core Boundaries `0.5.0`](./stability/decision-record-core-boundaries-0.5.0.md)
* [Migration Notes `0.5.0`](./stability/migration-notes-0.5.0.md)
* [Milestone Summary `0.5.0`](./stability/release-prep-0.5.0.md)

Runnable examples:

* [Examples Index](../examples/README.md)
* [Minimal Ingress Example](../examples/ingress-minimal.mjs)
* [Ingress Replay Pipeline Example](../examples/ingress-replay-pipeline.mjs)
* [False Audit Timeline Example](../examples/false-audit-timeline.mjs)
* [Offline Sync Anomalies Example](../examples/offline-sync-anomalies.mjs)
* [Streaming Recovery Resync Example](../examples/streaming-recovery-resync.mjs)

Failure-mode guides:

* [Replay Corruption](./replay-corruption.md)
* [Multi-Region Drift](./multi-region-drift.md)
* [False Audit Timelines](./false-audit-timeline.md)
* [Offline Sync Anomalies](./offline-sync-anomalies.md)
* [Causal Inversion](./causal-inversion.md)
* [AWS-Inspired DynamoDB Outage Exercise](./aws-inspired-dynamodb-outage.md)

The point of this section is not only to explain the API.
It is to show why the API exists.
