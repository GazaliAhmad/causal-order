# `0.6.0` Implementation Guide

`0.6.0` should be the first operational-tooling cut after the published `0.5.0` stability-and-contract-design release.

This note turns the broader `0.6.x` roadmap line into a narrower, commit-friendly first release shape.
It should help the repo decide what belongs in the first operational pass, what should follow later in the `0.6.x` line, and what should stay out of scope entirely.

For the broader milestone intent, see:

* [ROADMAP `0.6.x`](../../ROADMAP.md)
* [Release Notes `0.5.0`](../../docs/releases/0.5.0.md)
* [Implementation Guide `0.5.0`](../stability/implementation-guide-0.5.0.md)

## Working Rule

`0.6.0` should make the current package easier to operate in real pipelines without reopening the `0.5.0` contract boundary decisions.

That means:

* prefer additive helper surfaces over semantic rewrites
* prefer reference workflows over official transport or database adapters
* prefer operator visibility over convenience wrappers that hide the real package behavior
* prefer examples and guidance that use the public package surface directly

If a proposed `0.6.0` change starts to look like a domain-resolution feature, a transport client, or a shadow orchestration layer, it likely belongs in a later extension layer rather than in this first release.

## Sub-Goal

The first `0.6.0` release should prove that the clarified `0.5.0` surface can support real operational workflows without making the core runtime pretend to be:

* a queue
* a database
* a projection engine
* a tracing system
* a workflow framework

The central question is practical:

* can a maintainer or adopter inspect replay behavior, summarize anomalies, understand emitted order, and fit the library into common pipeline shapes without inventing a private helper layer first?

## `0.6.0` Release Shape

`0.6.0` should not try to finish all of `0.6.x`.
It should land the first coherent operational slice:

1. narrow inspection and debugging helpers
2. reference replay and reconciliation patterns
3. integration-shaped examples that stay package-facing
4. metrics and operator guidance
5. focused tests plus docs and release wording

That is enough to make the repo materially more usable in real event pipelines while still keeping the release narrow.

## Chunk Order

The intended landing order is:

1. operational inspection surface
2. replay and reconciliation workflow guidance
3. integration-shaped example coverage
4. operator metrics and monitoring guidance
5. docs, release wording, and focused verification

The ordering matters.
If the repo writes integration examples before the helper surface is clear, the examples will likely invent shadow abstractions.
If the repo writes monitoring guidance before the workflow language is settled, the metrics will look more precise than the actual operational story.

## `0.6.0` MVP Versus `0.6.1+`

The current `0.6.x` line is still larger than the first release needs to be.
So the practical split should be:

* `0.6.0`:
  * land the smallest coherent operational-tooling slice
  * prove the `0.5.0` contract can support real pipeline usage without private glue
* `0.6.1+`:
  * deepen the same operational theme after the first helper and workflow layer is real
  * add breadth and polish without turning the first cut into a catch-all milestone

The key question for `0.6.0` is not “what would be nice?”
It is:

* what is the smallest honest release that makes the package materially easier to operate?

## `0.6.0` MVP Must-Haves

The first `0.6.0` cut should include:

* one narrow operational inspection helper layer:
  * anomaly summary helper
  * replay or emitted-batch inspection helper
  * minimal explain-order helper or formatter over existing `orderBasis`, `confidence`, and `causalEvidence`
* two operator-facing workflow guides:
  * bounded replay inspection and derived-state writeback
  * streaming plus reconciliation follow-through for correction-capable output
* one or two integration-shaped examples:
  * local durable buffering into `translateBatch()` plus `orderEvents()`
  * one downstream storage or projection example that stays package-facing
* one baseline metrics guide covering:
  * watermark progress
  * late-arrival frequency
  * anomaly-rate monitoring
  * correction-rate monitoring
* focused tests, README alignment, and `0.6.0` release wording for the exact shipped helper surface

If `0.6.0` lands those pieces well, it is already a meaningful release.
It does not need to solve every operational shape in one pass.

## `0.6.1+` Follow-Through

The later `0.6.x` line can then deepen the same story through:

* broader helper coverage:
  * richer replay inspection views
  * deeper anomaly rollups
  * stronger explain-order output variants
* more integration-shaped examples:
  * broker or queue consumption
  * additional database-backed storage patterns
  * richer append-only versus mutable projection variants
* deeper monitoring and operator guidance:
  * alert heuristics
  * correction-churn interpretation
  * more detailed instrumentation snippets
* further docs and example polish once the first helper layer settles

That work still belongs to `0.6.x`.
It just does not all need to block `0.6.0`.

## Explicit `0.6.0` Deferrals

These should be treated as valid `0.6.1+` or later work unless the MVP turns out to be too thin:

* broker-specific or queue-specific example variants beyond the first generic integration story
* multiple storage-backend examples in the first cut
* advanced explain-order output formats
* large operator cookbook sections with many alert and dashboard variants
* broad docs synchronization expansion beyond what the first release-facing examples require
* any helper growth that starts to look like a companion CLI or workflow shell

## Release Decision Rule

The repo should prefer shipping `0.6.0` once these feel true:

* there is a real helper layer, not only roadmap wording
* there is at least one credible replay workflow and one credible reconciliation workflow
* there is at least one new integration-shaped example that users can copy without shadow abstractions
* there is enough metrics guidance that operators know what to watch first
* the docs and tests describe only what the shipped helper layer actually supports

If a candidate addition improves breadth but does not change that release honesty line, it is usually a strong `0.6.1+` candidate rather than a reason to delay `0.6.0`.

## Chunk 1: Operational Inspection Surface

This chunk should define the first additive helper layer around the current package output.

Checklist:

* decide the public shape for replay inspection helpers
* decide the public shape for anomaly summary helpers
* decide the public shape for explain-why-this-order debugging output
* keep every helper payload-agnostic and audit-visible
* add focused tests for deterministic helper output

Proposed issues:

* design the first public operational helper surface and keep it additive to `orderEvents()`, `orderEventStream()`, and `translateBatch()`
* add anomaly summary helpers that can roll up counts by kind, severity, and operational context without hiding raw anomalies
* add replay inspection helpers that make ordered output, non-final batches, and correction signals easier to inspect during debugging
* add explain-order helpers that expose existing `orderBasis`, `confidence`, and `causalEvidence` more directly without overstating certainty
* add focused tests that prove helper output stays deterministic and does not mutate source results

Done when:

* the repo has at least one clear helper story for operational inspection
* users can summarize anomalies and inspect emitted order without writing ad hoc analysis glue first
* the helper surface does not imply stronger causal or domain certainty than the core runtime can justify

## Chunk 2: Replay And Reconciliation Workflow Guidance

This chunk should turn the current conceptual story into a tighter operational playbook.

Checklist:

* connect bounded replay, live streaming, and hybrid reconciliation more explicitly
* make mutable versus append-only projection choices easier to compare
* make correction-capable batches easier to apply operationally
* keep raw events, anomalies, and derived state clearly separated

Proposed issues:

* add a dedicated replay-inspection workflow guide for bounded batch recovery, anomaly review, and derived-state writeback
* add a hybrid reconciliation workflow guide for immediate streaming plus periodic replay or rebuild
* add a focused note comparing append-only downstream projections versus mutable downstream projections under `emit_correction`
* add example snippets that show where raw events, emitted batches, anomalies, and projection updates should be stored separately

Done when:

* users can see how the same event model supports bounded replay, live streaming, and reconciliation follow-through
* the repo teaches a safer first downstream pattern for non-final output instead of only describing correction metadata abstractly
* maintainers have a repeatable operator-facing explanation for what should happen when correction-capable output arrives

## Chunk 3: Integration-Shaped Example Coverage

This chunk should make common deployment shapes easier to copy without turning the repo into an adapter catalog.

Checklist:

* add database-backed storage examples
* add broker or queue consumption examples
* add local file or disk-backed buffering examples
* keep examples dependency-light and package-facing
* avoid shipping official connectors in the core package

Proposed issues:

* add a database-backed event storage example that shows `raw_events`, derived ordered output, anomalies, and optional batch-run metadata
* add a broker or queue consumption example that shows how to feed `orderEventStream()` or batch replay without hiding the public API behind a framework wrapper
* add a local durable buffer example for file or disk-backed replay staging that demonstrates the `translateBatch()` to `orderEvents()` path
* expand the examples index so adopters can choose between replay, streaming, reconciliation, and integration-oriented examples more quickly

Done when:

* the repo includes at least a few integration-shaped examples beyond semantic scenario demos
* those examples still look like consumer-facing `causal-order` usage rather than repo-internal orchestration
* the examples do not require the core package to absorb transport, storage, or file-format responsibilities

## Chunk 4: Operator Metrics And Monitoring Guidance

This chunk should make the runtime easier to observe once it is deployed.

Checklist:

* define the practical metrics story for watermark progress
* define the practical metrics story for late arrivals
* define the practical metrics story for anomaly rates
* define the practical metrics story for correction rates
* tie those metrics back to the documented workflow patterns

Proposed issues:

* add an operator metrics guide covering watermark progress, buffered-versus-ready flow, late-arrival frequency, anomaly-rate monitoring, and correction-rate monitoring
* add instrumentation snippets that show how existing batch and stream results can feed counters, gauges, or logs without mutating runtime behavior
* document alert-oriented heuristics for when late arrivals, correction churn, or anomaly spikes likely indicate upstream contract drift

Done when:

* maintainers can explain what to watch in production without inventing a separate monitoring vocabulary
* adopters can connect output telemetry to dashboard-friendly metrics
* the guidance stays honest about what the current runtime can and cannot infer

## Chunk 5: Docs, Release Wording, And Focused Verification

This chunk should make the `0.6.0` scope read like one deliberate release instead of a pile of helpful fragments.

Checklist:

* align README, guides, examples, and changelog wording with the new operational layer
* add focused tests for any released helper surface
* keep docs synchronized with the runnable or inspectable examples
* record the `0.6.0` scope as a release-shaped story

Proposed issues:

* add focused tests for any helper exports introduced by `0.6.0`
* update README and guides to point to the new operational inspection and integration material
* add release notes that describe `0.6.0` as the first operational-tooling and integrations cut built on the published `0.5.0` boundary
* tighten docs synchronization checks if new examples or guide entry points become release-facing

Done when:

* the release can be described succinctly as an operational-tooling follow-through
* the docs point to the new operational material directly
* the verification story covers new helper outputs strongly enough that the package does not overclaim

## Out Of Scope For `0.6.0`

Avoid turning the first `0.6.0` cut into:

* official database connectors or broker clients
* a companion CLI or daemon layer
* async ingestion orchestration that hides `translateBatch()`, `orderEvents()`, or `orderEventStream()`
* payload-aware contradiction resolution, fork resolution, or semantic dedupe logic
* projection-specific domain logic that silently rewrites history
* a broad repository reorganization unrelated to operational tooling

Those may become later extension work, later `0.6.x` follow-through, or explicitly external companion tooling.
They should not be smuggled into the first `0.6.0` release under the label of “integration.”

## `0.6.0` Stopping Point

At a good `0.6.0` stopping point, the repo should be able to say:

* the published `0.5.0` contract now has a first operational helper layer
* adopters can inspect replay and stream output more easily
* the docs show practical pipeline patterns for replay, streaming, reconciliation, and basic integration shapes
* operator metrics guidance exists for watermark, late-arrival, anomaly, and correction visibility
* the package is more usable in real pipelines without pretending to be a queue, database, or domain-resolution engine

That is enough for a coherent first `0.6.0` release.
Anything larger should be a later `0.6.x` chunk rather than a blurred first cut.
