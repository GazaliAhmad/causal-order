# Guides

These guides are the practical path for evaluating, adopting, and operating `causal-order`.
They are organized around the questions most teams hit first:

* does this fit our problem
* how do we build a first flow with it
* how do we operate and inspect the output
* what support and upgrade posture should we expect

For the deeper conceptual layer and mental-model material, see the wiki.
For function-by-function reference, see the API docs.

Evaluate quickly:

* [Quick Start Scenarios](./quick-start-scenarios.md)
* [Examples And Entrypoints](./examples-and-entrypoints.md)
* [Package Surface Overview](./package-surface-overview.md)
* [Supported Vs Unsupported Usage](./supported-vs-unsupported-usage.md)
* [Case Studies](./case-studies.md)

Build with the package:

* [Package Surface Overview](./package-surface-overview.md)
* [Policy Guidance](./policy-guidance.md)
* [Mental Model](./mental-model.md)
* [Notation And Runtime Contract](./notation-and-runtime-contract.md)
* [How Order Is Written](./how-order-is-written.md)
* [Clocks, Causality, And Why HLC](./clocks-causality-and-why-hlc.md)
* [Upgrade Expectations](./upgrade-expectations.md)

Operate and inspect:

* [Replay Inspection Workflow](./operations/replay-inspection-workflow.md)
* [Streaming Reconciliation Workflow](./operations/streaming-reconciliation-workflow.md)
* [Operator Metrics Guide](./operations/operator-metrics-guide.md)
* [Streaming Recovery And Resync](./streaming-recovery-resync.md)
* [Stress Hardening](./stress-hardening.md)
* [After-Hours Batch Processing](./after-hours-batch-processing.md)

Failure modes:

* [Replay Corruption](./replay-corruption.md)
* [Multi-Region Drift](./multi-region-drift.md)
* [False Audit Timelines](./false-audit-timeline.md)
* [Offline Sync Anomalies](./offline-sync-anomalies.md)
* [Causal Inversion](./causal-inversion.md)
* [AWS-Inspired DynamoDB Outage Exercise](./aws-inspired-dynamodb-outage.md)

Support and upgrades:

* [Supported Vs Unsupported Usage](./supported-vs-unsupported-usage.md)
* [Upgrade Expectations](./upgrade-expectations.md)
* [Policy Guidance](./policy-guidance.md)

Workloads and hardening:

* [Anomaly Surface Audit](./hardening/anomaly-surface-0.3.2.md)
* [Fuzz Testing](./hardening/fuzz-testing-0.3.2.md)
* [Streaming Hardening And Pressure](./hardening/streaming-hardening-0.3.3.md)
* [Runtime Stability](./hardening/runtime-stability-0.3.4.md)

Release and maintenance context:

* [Developer Experience](./devex/developer-experience-0.4.0.md)
* [Implementation Guide `0.4.1`](./devex/implementation-guide-0.4.1.md)
* [Implementation Guide `0.4.2`](./devex/implementation-guide-0.4.2.md)
* [Release Notes `0.4.2`](../docs/releases/0.4.2.md)
* [Release Notes `0.5.0`](../docs/releases/0.5.0.md)
* [Release Notes `0.7.0`](../docs/releases/0.7.0.md)
* [Release Notes `0.8.0`](../docs/releases/0.8.0.md)
* [ROADMAP `0.8.0`](../ROADMAP.md)

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

* [Examples And Entrypoints](./examples-and-entrypoints.md)
* [Examples Index](../examples/README.md)
* [Minimal Ingress Example](../examples/ingress-minimal.mjs)
* [Ingress Replay Pipeline Example](../examples/ingress-replay-pipeline.mjs)
* [Local Durable Buffer Replay Example](../examples/local-durable-buffer-replay.mjs)
* [False Audit Timeline Example](../examples/false-audit-timeline.mjs)
* [Offline Sync Anomalies Example](../examples/offline-sync-anomalies.mjs)
* [Streaming Recovery Resync Example](../examples/streaming-recovery-resync.mjs)

The point of this section is not only to explain the API.
It is to show why the API exists.
