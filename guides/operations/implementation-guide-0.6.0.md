# `0.6.0` Implementation Guide

`0.6.0` is the published operational-tooling release built on top of the released `0.5.0` stability-and-contract-design boundary.

This note is the repo-local implementation record for what `0.6.0` shipped, how the scope was chunked, and what stayed outside the release.

For the broader release context, see:

* [ROADMAP](../../ROADMAP.md)
* [Release Notes `0.6.0`](../../docs/releases/0.6.0.md)
* [Release Notes `0.5.0`](../../docs/releases/0.5.0.md)
* [Implementation Guide `0.5.0`](../stability/implementation-guide-0.5.0.md)

## Working Rule

`0.6.0` made the package easier to operate in real pipelines without reopening the `0.5.0` contract-boundary decisions.

That release discipline stayed consistent throughout the line:

* additive helper surfaces instead of semantic rewrites
* reference workflows instead of official transport or database adapters
* operator visibility instead of convenience wrappers that hide package behavior
* examples and guidance built from the public package surface directly

## Release Shape

`0.6.0` landed as one narrow operational slice:

1. operational inspection helpers
2. replay and reconciliation workflow guides
3. an integration-shaped replay example
4. operator metrics guidance
5. release-facing docs alignment and focused verification

That was enough to make the repo materially easier to use in real event pipelines without turning the core runtime into a queue, database, projection engine, or workflow shell.

## What `0.6.0` Added

The release added:

* the first public `inspect` helper layer:
  * `summarizeEventAnomalies()`
  * `summarizeTranslationAnomalies()`
  * `explainOrderedEvent()`
  * `inspectOrderResult()`
  * `inspectOrderBatch()`
* the focused `causal-order/inspect` subpath
* operator-facing workflow guides for replay inspection and streaming reconciliation
* the first integration-shaped local durable-buffer replay example
* the first operator metrics guide for watermark, lateness, anomaly, and correction visibility
* release notes plus README, guides, wiki, and docs-sync follow-through for the shipped surface

## MVP Versus Follow-Through

The original chunking separated a smallest coherent `0.6.0` release from later breadth work.

The shipped `0.6.0` MVP included:

* one narrow inspection helper layer
* two operator-facing workflow guides
* one integration-shaped replay example
* one baseline metrics guide
* focused tests and release-facing documentation alignment

That left broader integration coverage, deeper cookbook material, and richer helper variants for later release lines instead of overloading `0.6.0`.

## Chunk 1: Operational Inspection Surface

This chunk established the first additive helper layer around current package output.

Landed surface:

* `summarizeEventAnomalies()`
* `summarizeTranslationAnomalies()`
* `explainOrderedEvent()`
* `inspectOrderResult()`
* `inspectOrderBatch()`

Release outcome:

* users can summarize anomalies and inspect emitted order without writing ad hoc analysis glue first
* helper output stays payload-agnostic and additive
* the helper layer does not mutate source results or imply stronger causal certainty than the runtime already exposes

## Chunk 2: Replay And Reconciliation Workflow Guidance

This chunk turned the broader replay and streaming story into tighter operator playbooks.

Landed artifacts:

* [Replay Inspection Workflow](./replay-inspection-workflow.md)
* [Streaming Reconciliation Workflow](./streaming-reconciliation-workflow.md)

Release outcome:

* bounded replay, live streaming, and reconciliation now have clearer operational follow-through
* correction-capable output has a safer first downstream story
* raw events, anomalies, emitted batches, and derived projections stay clearly separated

## Chunk 3: Integration-Shaped Example Coverage

This chunk added a first realistic integration slice without turning the repo into an adapter catalog.

Landed artifact:

* [Local Durable Buffer Replay Example](../../examples/local-durable-buffer-replay.mjs)

Release outcome:

* the repo now shows disk-backed JSONL staging feeding `translateBatch()`, `orderEvents()`, and `inspectOrderResult()`
* the example stays package-facing and dependency-light
* the release proves a realistic replay shape without absorbing connector responsibilities into the core package

## Chunk 4: Operator Metrics And Monitoring Guidance

This chunk made the runtime easier to observe once deployed.

Landed artifact:

* [Operator Metrics Guide](./operator-metrics-guide.md)

Release outcome:

* the first metrics vocabulary is explicit:
  * watermark progress
  * late-arrival frequency
  * anomaly-rate monitoring
  * correction-rate monitoring
* the guide stays honest about what the runtime can and cannot infer
* replay and streaming workflows now have a clearer first monitoring posture

## Chunk 5: Docs, Release Wording, And Focused Verification

This chunk made `0.6.0` read like one deliberate release instead of a pile of helpful fragments.

Landed follow-through:

* [Release Notes `0.6.0`](../../docs/releases/0.6.0.md)
* README alignment around inspection helpers and operational workflows
* guides index and wiki entry-point alignment
* docs-sync coverage for the new release-facing links and language

Release outcome:

* the `0.6.0` scope is documented as a published operational-tooling release
* the top-level docs now point directly at the released helper, workflow, example, and metrics surface
* the docs verification path enforces the released story more directly

## Out Of Scope For `0.6.0`

`0.6.0` intentionally did not turn into:

* official database connectors or broker clients
* a companion CLI or daemon layer
* async ingestion orchestration that hides `translateBatch()`, `orderEvents()`, or `orderEventStream()`
* payload-aware contradiction resolution, fork resolution, or semantic dedupe logic
* projection-specific domain logic that silently rewrites history
* a broad repository reorganization unrelated to operational tooling

Those remain later extension work rather than part of the released `0.6.0` package boundary.

## `0.6.0` Stopping Point

At the `0.6.0` stopping point, the repo can now say:

* the published `0.5.0` contract has a first operational helper layer
* adopters can inspect replay and stream output more easily
* the docs show practical pipeline patterns for replay, streaming, reconciliation, and a first integration shape
* operator metrics guidance exists for watermark, late-arrival, anomaly, and correction visibility
* the package is more usable in real pipelines without pretending to be a queue, database, or domain-resolution engine

That is the released `0.6.0` implementation scope this note records.
