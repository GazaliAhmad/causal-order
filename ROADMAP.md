# Roadmap

This roadmap describes how `causal-order` should mature from its current public `0.3.x` release line into a stable `1.0.0` npm package.

The goal is not to rush publication.
The goal is to make sure the semantics are trustworthy before the package becomes a long-term contract.

## Principles

The roadmap is guided by four constraints:

* correctness matters more than feature count
* uncertainty must be represented honestly
* streaming claims must be operationally real, not aspirational
* examples and docs are part of the product, not a cleanup task

## `1.0` Design Principles

The core design challenge is not whether distributed event uncertainty is real.
It is whether the package can stay understandable while remaining honest.

`causal-order` should aim for an API that is easy to adopt at the surface, but difficult to misuse into false certainty.

Design standards for `1.0`:

* a normal developer should be able to get value in minutes, not after reading the full specification
* the default API must never silently upgrade weak evidence into strong claims
* simple usage should stay simple, without forcing every user to learn the full causal model on day one
* deeper truth must remain available through inspectable confidence, ordering basis, causal evidence, anomalies, and stream finality semantics
* names should sound operational and clear, not academic for its own sake
* outputs should help users answer:
  * what happened?
  * how sure are we?
  * why does the library think that?
  * what should we be careful about?
* strict mode should be real and useful, not just more annoying
* uncertainty should lead to action:
  * inspect a concurrent group
  * flag a suspicious event
  * keep a stream window open longer
  * avoid publishing a false audit timeline
* determinism is required even when certainty is not
* streaming finality must remain framed as an operational decision, not a causal truth claim

Release bar for `1.0`:

* the top-level API surface feels small and stable
* the README teaches the mental model without overwhelming first-time users
* result objects are easy to inspect and hard to misuse
* tests and examples cover the common distributed failure modes the package claims to handle
* there is no major place where the library hides uncertainty behind a clean-looking answer
* a new user can explain the package simply:
  * it helps order distributed events honestly and tells me how trustworthy that order is

For new features, the default design test should be:

* does this make first use clearer or harder?
* does this preserve honesty?
* does this expose useful depth without forcing it on everyone?
* would an ordinary backend engineer understand the name?
* does this create a cleaner mental model, not just a richer one?

## Platform Baseline

Current intended platform posture:

* active repository development targets Node.js `24`
* published package support begins at Node.js `20+`
* Node.js `18` remains in CI for best-effort regression detection, not as a formal long-term support contract
* ESM only
* core time representation stays primitive: `bigint` epoch milliseconds
* no `Temporal` requirement in the core package

## Realistic Workload Model

The roadmap should optimize for real operational slices, not vanity-scale numbers.

In most actual use cases, the unit of work is not "all historical events everywhere."
It is something more bounded:

* a single audit reconstruction
* a replay batch
* a tenant or partition slice
* a device or account history
* a bounded streaming window

That means the design target should be:

* `10k` events should feel routine
* `100k` events should feel credible and well-supported
* `1M+` events should be treated as a deliberate scalability track, not as the baseline promise for every use case

Current benchmarking posture:

* `100k` remains the main enforced large-batch guardrail
* `150k` benchmark profiles are useful stretch visibility, but should not yet be treated as the formal baseline promise for CI enforcement
* if `150k` becomes a required guard later, the docs and performance policy should be updated together rather than drifting separately

This distinction matters because there is no end to abstract number-chasing.
If the package says `1M`, someone will ask why not `10M`.
The better standard is whether the package is strong for the kinds of event sets that teams actually inspect together.

For truly large or unbounded workloads, the roadmap should prefer batching, partitioning, and `orderEventStream()` semantics over pretending one giant in-memory batch is the primary model.

## `1.0` Release Checklist

Before `causal-order` should be considered ready for `1.0.0`, these should all feel true:

* the top-level API names and exported result types feel stable enough to support long-term
* confidence semantics for `proven`, `derived`, `fallback`, and `unknown` are crisp and no longer expected to change materially
* `orderBasis`, `causalEvidence`, anomaly types, and strict-mode behavior feel intentional rather than exploratory
* the difference between `orderEvents()` and `orderEventStream()` is clear in both code and docs
* the README describes the real shipped package, not a still-evolving intended shape
* examples clearly show why this library is safer than naive timestamp sorting
* performance guidance is honest about routine workloads, heavier batch workloads, and when streaming is the better model
* large-batch behavior has been benchmarked and pressure-tested enough that major surprises are unlikely in realistic use
* anomaly and error messages are useful enough to support real debugging and audit work
* the project is ready to preserve the semantics as a public contract, not just the function names

Current status snapshot:

| Checklist Item | Status | Notes |
| --- | --- | --- |
| Top-level API names and exported result types feel stable enough to support long-term | Partial | The surface is getting coherent, but semantics are still being hardened through testing and iteration. |
| Confidence semantics are crisp and no longer expected to change materially | Partial | The model is strong, but still feels like it is being frozen rather than already frozen. |
| `orderBasis`, `causalEvidence`, anomaly types, and strict-mode behavior feel intentional rather than exploratory | Partial | Stronger than before, but some stream semantics and a few public-contract decisions still feel actively defined. |
| The difference between `orderEvents()` and `orderEventStream()` is clear in both code and docs | Partial | The boundary is now clearer in the README, guides, examples, and website surface, but it can still be made more explicit before `1.0`. |
| The README describes the real shipped package, not a still-evolving intended shape | Partial | The README is now npm-facing, package-oriented, and better aligned with the current `0.3.3` work, but the broader documentation set still needs to feel fully settled as a long-term contract. |
| Examples clearly show why this library is safer than naive timestamp sorting | Partial | The examples are good and aligned to failure modes, but can still be made more central for `1.0`. |
| Performance guidance is honest about routine workloads, heavier batch workloads, and when streaming is the better model | Partial | This is now grounded by named `100k`, `150k`, and exploratory `250k` profiles plus explicit stream-guard policy, but it still needs more time and repetition to feel fully settled. |
| Large-batch behavior has been benchmarked and pressure-tested enough that major surprises are unlikely in realistic use | Partial | This is the stronger current posture in the core library, but more repeated pressure would still strengthen confidence further and the larger remaining runtime-hardening question is on streaming. |
| Anomaly and error messages are useful enough to support real debugging and audit work | Partial | Coverage is stronger, but message quality still feels like a polish area rather than a closed one. |
| The project is ready to preserve the semantics as a public contract, not just the function names | Not Yet | This is the real `1.0` threshold, and the project does not appear to be claiming that yet. |

## Release Phases

## `0.1.x` Foundation

Goal:
Make the core API real, usable, and internally consistent.

Focus:

* stabilize core TypeScript types
* harden HLC generation, merge, parse, and serialize behavior
* validate event envelopes and clocks consistently
* make `orderEvents()` usable for real small-to-medium workloads
* keep confidence semantics explicit:
  * `proven`
  * `derived`
  * `fallback`
  * `unknown`
* make `CausalEvidence` inspectable in outputs
* document strict rules for:
  * HLC-only ordering
  * `concurrent` vs `unknown`
  * parser throwing vs batch validation

Exit criteria:

* public API shape feels coherent
* basic examples work end-to-end
* early tests cover core ordering semantics
* README explains the mental model clearly

## `0.2.x` Semantics Hardening

Goal:
Pressure-test the meaning of the library, not just the syntax.

This work is not starting from zero.
Late `0.1.x` preparation has already tightened some semantics, especially around preferring `unknown` over speculative concurrency.
The purpose of `0.2.x` is to finish and extend that hardening rather than introducing the idea for the first time.

Focus:

* add tests for edge cases and regressions
* refine causal evidence rules and comparison semantics
* add replay corruption examples
* add false audit timeline examples
* add multi-region drift examples
* add offline sync anomaly examples
* make anomaly messages more useful for debugging
* clarify what counts as proven causality in difficult cases

### `0.2.0` Semantic Decision: `concurrent` vs `unknown`

A key `0.2.0` goal is to make the library stricter and more honest about unresolved relationships.

`concurrent` and `unknown` should not mean the same thing.

For this release line:

* `concurrent` is a positive claim
* `unknown` is the absence of a defensible claim

### Intended Meaning

* `before`: the library can justify that `A` happened before `B` within the supported causal model
* `after`: the library can justify that `A` happened after `B` within the supported causal model
* `equal`: both references identify the same event
* `concurrent`: the library can positively justify that neither event is known to come before the other within the supported causal model
* `unknown`: the library cannot honestly justify ordering or concurrency

### Supported Causal Signals For `0.2.0`

For `0.2.0`, only these should count as causality-bearing signals:

* `parentEventId`
* `dependencyEventIds`
* same-node monotonic `sequence`

The following may support deterministic or operational ordering, but should not by themselves prove causality:

* HLC comparison
* raw timestamps
* ingestion order
* shared `traceId`
* shared `partition`

### Pairwise Comparison Rule

The intended comparison rule for `0.2.0` is:

1. return `equal` when both references identify the same event
2. return `unknown` if either event is invalid
3. return `before` if `B` explicitly names `A` as a parent or dependency
4. return `after` if `A` explicitly names `B` as a parent or dependency
5. for same-node events with valid, distinct `sequence` values:
   * lower sequence means `before`
   * higher sequence means `after`
6. for same-node events with missing, equal, or unusable sequence evidence, return `unknown` unless another supported causal signal applies
7. for cross-node events with no explicit supported causal edge, return `unknown`
8. do not infer `concurrent` from missing evidence alone

### Practical Consequence

This means `0.2.0` should prefer honest ambiguity over confident-looking grouping.

Examples:

* two cross-node events with no dependency relationship should usually be `unknown`
* two same-node events with usable sequence metadata can still be ordered
* HLC-only ordering remains useful, but should stay `derived` rather than causally `proven`

### Consequence For Concurrency Claims

Any future concurrency-oriented output should only contain events that are truly concurrent under the supported model.

That means:

* the current runtime should prefer `unknown` over speculative concurrency
* any future grouping or concurrency-focused output must justify its claims more strongly than missing evidence alone
* removing or withholding concurrency-shaped output is acceptable if it removes false certainty

### Release Intent

This is a semantics-hardening change, not just an implementation cleanup.

The purpose of `0.2.0` is to make sure the library does not label lack of evidence as concurrency, and does not hide uncertainty behind a clean-looking result.

### `0.2.0` Scope Decision: `traceId` and `partition`

For `0.2.0`, `traceId` and `partition` should remain metadata, not causality-bearing signals.

That means:

* shared `traceId` should be treated as correlation metadata only
* shared `partition` should be treated as scoping metadata only
* neither field should, by itself, change `before`, `after`, `concurrent`, or `unknown`
* neither field should, by itself, upgrade confidence to `proven`

This keeps the release honest and avoids turning weak correlation into false causal certainty.

### Future Path

Possible future extensions should require stronger structure rather than looser inference.

For trace-derived causality:

* add explicit span-level structure such as `spanId`
* add explicit parent-child span structure such as `parentSpanId`
* define whether trace parent-child relationships count as `proven` or only `derived`
* define behavior for retries, fan-out, async hops, and partial traces

For partition-aware ordering:

* add explicit monotonic partition position metadata such as `partitionOffset`
* define what guarantee that position carries in the source system
* treat partition-local ordering as a candidate for `derived` ordering, not automatic causal proof
* define behavior for replay, compaction, rebalancing, and duplicate delivery

Exit criteria:

* users can understand why outputs are labeled the way they are
* “why not just sort by timestamp?” has strong concrete answers
* tricky event sets no longer expose major semantic ambiguity

### `0.2.2` Completed: Corrupted Dataset Stress Hardening

`0.2.0` was the published semantics-hardening baseline.
`0.2.1` was an internal intermediate repo step.
`0.2.2` is the release where that work was followed through into explicit corrupted-dataset stress testing and the resulting large-batch performance hardening.

Focus:

* add explicit `150k`-scale stress benchmarks for anomaly-heavy and corruption-heavy datasets
* benchmark large synthetic expansions of:
  * multi-region drift
  * replay corruption
  * offline sync anomalies
  * "unknown" case-study style cross-node ambiguity
* add explicit corrupted-dataset stress coverage for:
  * duplicate explosion density
  * inversion chain density
  * malformed-event ratios
  * sparse-causality graphs
  * massive same-timestamp clusters
  * replay storms
  * cyclic dependency attempts
  * sequence conflicts
* distinguish clearly between:
  * routine `100k` batch behavior
  * anomaly-heavy `150k` stress behavior
* identify whether replay-heavy and offline-sync-heavy workloads need targeted performance work
* document the difference between semantic correctness under stress and performance comfort under stress

Why this belongs after `0.2.0`:

* `0.2.0` is primarily a semantics and API cleanup release
* the corrupted-dataset stress work is better treated as stabilization and pressure-testing
* this keeps the semantic release crisp while preserving a clear next step for hardening

Current take after implementation:

* this was worth doing because it pressure-tested the shipped semantics under ugly but realistic data shapes instead of only under small scenario fixtures
* the stress suite confirmed that the semantic model still holds under `150k` corrupted-dataset pressure
* the work exposed a real performance cliff in the ordering queue path that would have been easy to underestimate from small tests alone
* the right product story remains:
  * `100k` is the routine credible batch band
  * `150k` is the corrupted-dataset stress band for hardening and visibility
* this should not turn into open-ended number chasing:
  * the value came from targeted corruption shapes, not from chasing arbitrary larger counts

Initial benchmark matrix:

| Priority | Stress Profile | Scale Target | Main Question |
| --- | --- | --- | --- |
| 1 | duplicate explosion density | `150k` | Does repeated duplicate pressure stay visible without causing pathological graph or anomaly overhead? |
| 2 | malformed-event ratios | `150k` | Does invalid-data survival remain stable when malformed records are no longer rare edge cases? |
| 3 | sequence conflicts | `150k` | Do same-node ordering conflicts stay honest and performant under heavy contradiction? |
| 4 | cyclic dependency attempts | `150k` | Can dependency-cycle detection remain robust without turning stress input into runaway work? |
| 5 | replay storms | `150k` | Does replay-heavy input expose regression risk in duplicate handling, anomaly volume, or ordering cost? |
| 6 | massive same-timestamp clusters | `150k` | Do large tie clusters preserve deterministic behavior without excessive bookkeeping churn? |
| 7 | sparse-causality graphs | `150k` | Does the library stay efficient when many events carry weak evidence and cannot be richly connected? |
| 8 | inversion chain density | `150k` | Do long contradictory causal-looking chains surface cleanly without hidden semantic drift? |

Implementation posture for the matrix:

* treat `100k` routine behavior as the baseline comparison band
* treat `150k` corrupted-dataset profiles as the main `0.2.2` stress band
* prefer named synthetic profiles over one giant mixed-chaos profile so regressions stay attributable
* start by enforcing correctness and survivability, then decide later which stress profiles deserve timing or memory thresholds
* keep `250k+` experiments as optional visibility work unless real usage evidence justifies expanding the milestone
* prioritize real operational questions over vanity-scale claims:
  * can the library stay honest under replay, duplication, inversion, malformed data, sparse evidence, and conflict-heavy input?

Current outcome snapshot:

* the repo now has named `150k` corrupted-dataset stress profiles for the planned matrix
* the normal test suite now includes smaller verification coverage for those stress generators
* the stress work found and fixed a major ready-queue performance bottleneck in `orderEvents()`
* follow-up optimization work also reduced duplicate validation and some anomaly-path allocation churn
* the result is much stronger evidence that the library remains usable under corrupted large-batch pressure, not just under human-sized semantic fixtures
* this also clarifies the current operational posture:
  * `0.2.2` is the batch recovery and scheduled reconciliation story
  * HLC, same-node `sequence`, and explicit dependency metadata are used to reconstruct a delayed replay batch honestly after outage recovery
  * bounded batch recovery, replay, and audit-style workloads are the stronger current deployment story in the core library

Success criteria:

* the repo has named benchmark coverage for these corruption-heavy patterns
* the repo has explicit stress profiles or fixtures covering duplicate pressure, inversion pressure, malformed ratios, sparse causality, timestamp clustering, replay storms, dependency cycles, and sequence conflicts
* maintainers can compare normal large-batch profiles against anomaly-heavy stress profiles
* any serious stress-path regressions are visible before later release lines
* follow-up performance work, if needed, can be scoped from real benchmark evidence rather than intuition

## `0.3.0` Completed Milestone: Streaming Reality

Goal:
Ship the core streaming contract cleanly.

Focus:

* improve `orderEventStream()`
* make the semantic role of `flushReady()` explicit:
  * `0.3.0` owns correctness of when events become ready, when corrections are emitted, and when batches are final
  * `0.3.1` owns the remaining semantic edge-case cleanup once the baseline contract is documented
  * `0.3.2` owns proving that the settled current-core and streaming claims are production-credible through explicit release gates
  * `0.3.3` owns the broader remaining pressure behavior, bounded-memory hardening, and follow-up optimization once that first production gate is in place
* lock the first intentional stream-facing option surface around the current parameters:
  * `batchSize`
  * `maxLateArrivalMs`
  * `lateArrivalPolicy`
  * `watermark`
* provide the best middle ground for watermark configuration:
  * keep the default watermark behavior conservative and event-driven
  * do not silently advance stream progress from system time by default
  * provide built-in opt-in watermark strategy helpers so users do not need to invent common operational policies from scratch
* establish baseline watermark correctness:
  * default watermark progression is documented and consistent
  * baseline non-late vs late handling is correct for ordinary stream flows
  * idle-source behavior is explicit enough that one silent producer does not accidentally stall the whole ordering pipeline without that being an intentional design choice
* define silent-producer and idle-source handling explicitly:
  * if watermark progress depends only on observed event arrival, stream progress can stall indefinitely when the source stops producing the watermark-driving signals needed to advance it honestly
  * document how users can advance watermark progress or handle idle sources, whether through heartbeats, `maxIdleMs`, an external watermark strategy, or a clearly documented upstream responsibility
* establish baseline late-arrival policy correctness:
  * `flag`
  * `drop`
  * `emit_correction`
  * `fail`
* define batch correction behavior more clearly
* make routine continuous operations, outage recovery, and offline-sync recovery all first-class streaming use cases:
  * ordinary day-to-day stream ingestion where output must keep moving
  * local queue to central replay flow
  * delayed reconnect batches
  * correction behavior during resync
  * storing ordered stream output back into DB tables as derived operational state
* explain the relationship between the two operational modes clearly:
  * batch mode uses HLC plus event metadata to order a finite replayed or scheduled backlog before writing derived results back into central storage
  * streaming mode uses the same event model, but adds watermark, lateness, and correction behavior for both steady-state continuous operations and continuous resync

Why this was the right public milestone:

* `0.2.x` has now done the main semantics and corrupted-dataset stress hardening work it needed to do
* the most important remaining credibility questions are now on the streaming path, not the large-batch path
* steady-state streaming, outage recovery, and offline-sync recovery now belong here because the remaining challenge is operational continuous reconciliation, not core ordering meaning
* promoting this to `0.3.0` keeps the version story honest:
  * `0.2.0` was the published semantics-hardening baseline
  * `0.2.1` was an internal intermediate repo step
  * `0.2.2` was the stress-hardening release
  * `0.3.0` is the next meaningful behavioral milestone

Exit criteria:

* streaming behavior matches the documented policy
* late events are never hidden by accident
* baseline watermark and late-arrival behavior are correct for the intended first contract
* the stream-facing parameters and policies feel intentional rather than provisional
* watermark configuration has a conservative default plus explicit built-in opt-in strategies for teams that want different liveness tradeoffs
* the continuous operations and recovery story is documented clearly enough that `0.3.1` can focus on semantic tightening rather than basic framing

Completed in the current repo state:

* the stream-facing option surface is implemented and tested around `batchSize`, `maxLateArrivalMs`, `lateArrivalPolicy`, and `watermark`
* default watermark progression is conservative and event-driven, with opt-in helpers for `ingestedAt` and processing-time strategies
* `flag`, `drop`, `emit_correction`, and `fail` all have direct streaming coverage
* steady-state streaming plus delayed reconnect and continuous recovery behavior are documented with a dedicated streaming recovery and resync guide plus runnable example
* correction-capable downstream handling is documented as provisional derived-state reconciliation rather than hidden finality
* the initial `flushReady()` path has already received baseline overhead reduction work so repeated rescans are no longer entirely unbounded by default behavior
* the perf harness now includes a dedicated streaming benchmark profile for direct watermark-driven flush measurement

## `0.3.1` Completed Milestone: Streaming Semantic Tightening

Goal:
Tighten the edge cases in the `0.3.0` baseline streaming contract before heavier pressure work.

Focus:

* clarify custom `watermark` callback semantics so callers know whether they are supplying an event timestamp, a candidate watermark, or another stream-progress signal
* make the relationship between operational lateness and causal confidence explicit:
  * `maxLateArrivalMs` and watermark progress control stream handling, not whether causal evidence is `proven`
  * an event may be causally older with explicit evidence and still be operationally too late for the active stream window
* align the boundary semantics for:
  * when an event is considered late
  * when an event is considered ready to flush
* define the cross-window anomaly contract more explicitly:
  * what stream-local history is retained
  * which anomaly types can still be detected after earlier windows have been emitted
* define correction behavior more precisely for delayed reconnect and resync cases before stress-testing those flows
* define the legal correction scope:
  * how far back in already-emitted stream history a correction is allowed to reach
  * whether that lookback limit is watermark-based, window-based, or policy-based
  * what the library guarantees once emitted output is older than the supported correction horizon
* define the correction contract explicitly:
  * `lateArrivalPolicy: "emit_correction"` implies a correction-capable downstream model
  * clarify whether the library provides correction logic, correction signals, or only operational notice that previously emitted output may need reconciliation
  * make the distinction between `ready` output and `final` output explicit enough for users writing to non-transactional or append-only stores
* add direct semantic coverage for under-tested stream options and behaviors:
  * custom `watermark`
  * non-trivial `batchSize` cases
* keep this release focused on edge-case semantic tightening rather than throughput or memory optimization

Exit criteria:

* custom watermark behavior is documented and testable rather than implicit
* the relationship between HLC/causal confidence and `maxLateArrivalMs` is clear enough that users do not confuse operational lateness with causal uncertainty
* late-arrival and ready-to-flush boundaries are consistent
* correction lookback limits are explicit enough that consumers know when previously emitted output can still change
* the distinction between `ready` output and `final` output is clear enough that downstream consumers can choose a safe storage pattern
* the cross-window anomaly contract is stated clearly enough that `0.3.2` can turn it into an explicit production gate without reopening semantic questions

Completed in the current repo state:

* custom `watermark` semantics are explicit in the public docs, runtime messaging, and test coverage as stream-progress signals rather than implicit final watermarks
* the late-versus-ready boundary contract is explicit and tested:
  * `eventTime <= batch.watermark` is ready to flush
  * `eventTime < batch.watermark` is late
* the relationship between operational lateness and causal confidence is documented more directly so watermark progress and `maxLateArrivalMs` are not confused with causal proof
* correction signaling is now machine-readable through `batch.correction`
* the current correction scope is explicit as a policy-based reconciliation model over previously emitted non-final output in the same stream instance
* the current cross-window anomaly contract is explicit through `batch.anomalyHorizon`, including:
  * `buffered_window_only` retained emitted-history semantics
  * `late_arrival_only` cross-window relational anomaly carry
* under-tested stream options and behaviors now have direct semantic coverage, especially:
  * custom `watermark`
  * non-trivial `batchSize`
  * delayed reconnect correction fragmentation
  * lagging-watermark ready-subset emission
* downstream guidance now makes the distinction between provisional non-final output and terminal final output explicit enough for mutable, append-only, non-transactional, and partially transactional sinks
* streaming flushes now reuse already-validated buffered events through an internal fast path instead of revalidating every ready batch from scratch
* the `streaming-100k-plateaus` benchmark profile is now actually anomaly-free as intended, and `perf/check` includes a dedicated streaming guard to catch future synthetic-clock regressions
* the README, guides, wiki, examples, changelog, and tests now present the same safer deployment-oriented story:
  * the library is designed for systems that cannot rely on a globally synchronized clock
  * it supports operationally honest event processing without claiming universal production proof or globally complete ordering

## `0.3.2` Production Gate Hardening

Goal:
Prove that the current `0.3.1` semantics are production-credible before expanding the scope again.

This milestone is not about adding a new semantic layer.
It is about making sure the current core claims are backed by explicit release gates, explicit tests, and explicit operational honesty.

Focus:

* add a production release-gate document that defines what must pass before a release can be called production-credible
* harden and verify the current-core gate categories that already fit the library's present model:
  * missing parent events
  * offline device merge
  * duplicate event storms for exact duplicate IDs
  * clock reset scenarios
  * massive out-of-order replay
  * partial log corruption
* make sure each of those categories has explicit pass/fail assertions rather than only scenario-style examples
* ensure the current anomaly surface is sufficient for the current-core gate set, or make the missing current-core signals explicit
* keep determinism as a hard release requirement:
  * same input must produce the same ordered output
  * same input must produce the same anomaly output
  * shuffled arrival order must not change causally justified conclusions
* strengthen streaming pressure coverage where it directly supports the current shipped contract:
  * pathological late arrivals
  * reconnect correction pressure
  * watermark pressure
  * lagging-watermark plus `batchSize` pressure
  * bounded-memory and backpressure behavior
* add a seeded operational fuzz suite for the current contract so realistic outage and recovery randomness can be replayed exactly:
  * randomized delays simulating `4` to `8` hour outage backlog
  * randomized drops simulating local node fire-and-forget behavior
  * randomized exact-duplicate uploads simulating manual plus automatic replay
  * randomized reordering simulating after-hours batch jobs and delayed processing
  * randomized clock drift simulating wrong-time clinic or hospital workstations
  * randomized concurrency storms simulating many nodes updating at once
* keep the first fuzz suite scoped to current-core and current-stream semantics rather than future domain-aware merge policy:
  * same seed must reproduce the same ordered output
  * same seed must reproduce the same anomaly output
  * shuffled arrival order must not change causally justified conclusions
  * exact duplicate IDs must remain visible
  * invalid clocks must not be silently normalized
  * same-node sequence truth must survive replay, reconnect, and delay noise
  * stream late-arrival handling must match the configured policy
  * conflicting-edit fuzzing may be explored only insofar as it checks current-core honesty, not domain-aware merge semantics
* align tests, perf checks, docs, and release policy so the repo makes one consistent claim about what is currently production-credible

Why this should be a separate milestone:

* `0.3.1` has already defined the current streaming semantics more clearly
* the next honest question is not "what else could the library do?"
* the next honest question is "which of the current claims are strong enough to call production-credible?"
* separating this work prevents production language from outrunning test evidence
* it also avoids mixing current-core hardening with later domain-semantic features that need new product design
* the batch side already has the stronger bounded-workload deployment story, so the larger remaining credibility question belongs on the streaming path

What this milestone does not try to solve yet:

* contradictory domain events
* entity fork semantics
* semantic duplicate detection for different event IDs that represent the same action

Those are important, but they require domain-aware policy or extension-point design rather than only more pressure on the current payload-agnostic core.

Exit criteria:

* the repo contains an explicit production gate document for the current release line
* the current-core gate categories have direct automated coverage with release-blocking assertions
* deterministic behavior is explicitly tested across repeated runs and shuffled inputs for the covered categories
* streaming pressure behavior is covered strongly enough that the current streaming contract is operationally credible rather than only conceptually described
* seeded fuzz failures are reproducible enough that a failing operational scenario can be rerun from its recorded seed
* docs and release wording do not claim more than the tested current-core semantics can honestly support

## `0.3.3` Streaming Hardening And Pressure

Goal:
Broaden the streaming hardening and pressure work after the current semantics passed the first production gate milestone.

This release builds on the credibility established in `0.3.2` rather than trying to establish that credibility and broaden the pressure scope at the same time.

Focus:

* continued optimizing the `flushReady()` path so repeated scans, compaction, and pressure behavior did not remain the next streaming performance cliff
* continued profiling and tightening anomaly-heavy batch and stream paths, especially where large anomaly volumes create GC pressure or throughput cliffs
* extended streaming stress coverage beyond the minimum release-gate set once the baseline production gates were in place
* added longer-running exploratory seeded fuzz campaigns beyond the `0.3.2` release-gate suite:
  * use higher-cardinality randomized outage, recovery, replay, and concurrency runs to expose sustained pressure behavior
  * use these campaigns to discover correction-window churn, watermark-lag, memory-growth, and throughput cliffs that smaller release-gate fuzzing is not designed to exhaust
  * treat these campaigns as hotspot-discovery and pressure-evidence tooling rather than as the primary correctness gate for the current contract
* pressure-tested correction-window behavior during resync and delayed reconnect flows beyond small semantic fixtures
* extended watermark-pressure coverage from correctness-only toward sustained operational pressure
* strengthened bounded-memory demonstrations and backpressure guidance with more explicit heavy-pressure cases
* decided which additional streaming stress profiles were stable enough to enforce in perf checks
* kept optimization discipline evidence-driven:
  * retain optimizations that measurably improve guarded or stressed workloads
  * revert micro-optimizations that preserve correctness but do not produce meaningful wins
  * let CPU profiles, GC behavior, and guarded stress runs decide the next hotspot

Why this followed `0.3.2`:

* `0.3.2` answered whether the current contract was already credible enough to defend
* `0.3.3` could then safely widen the pressure work without blurring the release story
* this keeps the sequencing honest:
  * first prove the current claims
  * then keep hardening the pressure envelope around those claims

Exit criteria:

* broader streaming pressure coverage exists beyond the minimum `0.3.2` release-gate set
* the most important remaining streaming hotspots have fresh profile-backed evidence
* bounded-memory and backpressure behavior are not only documented, but exercised under stronger pressure conditions
* maintainers have clearer evidence for which streaming stress cases should become future enforced guards

## `0.3.4` Sustained Operational Stability Under Prolonged And Constrained Runtime Conditions

Goal:
Prove that the current streaming contract remains operationally stable not only under broader pressure, but also under prolonged runtime and constrained-memory conditions.

This milestone followed `0.3.3`.
`0.3.3` widened pressure visibility and hotspot evidence.
`0.3.4` turns the most important runtime questions from that work into stronger stability proof.

Focus:

* long-running multi-hour stability
* repeated stream cycles without process restart
* anomaly-heavy streaming stability under sustained pressure
* reconnect correction churn under sustained load
* stability under smaller Node heap limits
* stability when GC triggers during the run

Current repo progress:

* repeated-cycle and time-boxed stream endurance harness support is in the repo
* constrained-heap stream endurance support is in the repo
* GC-observed stream endurance support is in the repo
* sustained correction-churn and anomaly-heavy reconnect endurance profiles are in the repo

The current `0.3.4` posture is therefore no longer only a plan.
The line now has explicit runtime-stability evidence for repeated cycles, constrained heaps, GC-observed runs, and sustained correction/reconnect endurance cases.

Why this should be a separate milestone:

* this is a stronger claim than broader pressure visibility
* it moves from exploratory hardening evidence toward sustained runtime proof
* it requires longer-running and more operationally constrained evidence than the earlier `0.3.3` pressure work

Why this should happen before ecosystem expansion:

* the core library is the trust boundary
* ecosystem packages should not solidify around a core runtime contract that still feels operationally unsettled
* the safer sequence is to settle the core contract first, prove it under sustained runtime pressure, and expand into higher-level ecosystem work later

Exit criteria:

* the repo has explicit endurance-oriented evidence for multi-hour stream stability rather than only shorter pressure snapshots
* repeated benchmark or stress cycles can run in one process without obvious retained-heap drift or instability
* anomaly-heavy and reconnect-correction-heavy workloads remain operationally credible under sustained load
* smaller-heap runs produce honest and documented behavior rather than only best-case default-runtime behavior
* GC-triggered runs are observed directly enough that maintainers can reason about the current streaming contract under real collection pressure

Current outcome:

* `0.3.4` has established the runtime-stability evidence line that follows the broader `0.3.3` pressure release
* the next meaningful maturity step is no longer basic runtime-stability scaffolding, but the later API, tooling, and adoption milestones that follow it

## `0.4.x` Developer Experience

Goal:
Make the package easy to adopt without reading the full spec first.

Focus:

* improve API ergonomics where it helps without weakening rigor
* add examples directory
* add a tiny CLI demo for fast hands-on evaluation, for example:
  * `npx causal-order-demo sample.jsonl`
* add JSONL adapter
* improve error messages and anomaly formatting
* add quick-start samples for:
  * audit reconstruction
  * replay pipelines
  * distributed debugging
  * offline sync inspection
* add guidance for choosing strict mode and late-arrival policies
* document stricter-mode guidance more explicitly, including where fail-fast behavior is the safer operational choice:
  * audit and compliance pipelines
  * financial or regulated event processing
  * CI and fixture verification
  * upstream data-quality enforcement
  * producer debugging and contract testing

Exit criteria:

* new users can get value from the package quickly
* examples teach the mental shift effectively
* common use cases are obvious from docs alone

## `0.5.x` Stability Candidate And Domain-Semantic Contract Design

Goal:
Decide whether the public contract is truly ready to stabilize, and explicitly design the domain-semantic extension areas that `1.0.0` must either support clearly or leave out of scope clearly.

This milestone should not pretend that all important semantics belong in the payload-agnostic core.
Instead, it should decide which semantics are core, which belong behind extension points or policies, and which should remain intentionally unsupported for `1.0`.

Focus:

* remove avoidable naming ambiguity
* review all exported types for long-term stability
* review default behaviors carefully
* identify anything still experimental and either remove it or mark it clearly
* add compatibility and migration notes
* expand test coverage around public surface area

In addition, explicitly scope the domain-semantic design work that is not fully handled by the current payload-agnostic core:

* contradictory events:
  * define whether contradiction handling belongs in the core runtime, an extension hook, or a higher-layer policy model
  * define what contradiction output should look like
  * define strict versus non-strict behavior for contradiction detection
* entity forks:
  * define how logical entity identity is supplied
  * define when two histories count as a fork
  * define what unresolved fork output should look like
  * define where human or domain-policy resolution begins
* semantic duplicate detection for different IDs:
  * define whether this is detection-only or merge-capable
  * define what evidence a dedupe policy can use
  * define replay-safe behavior
  * define how operator visibility is preserved so semantic dedupe does not become silent history rewriting

Questions to answer before `1.0.0`:

* are confidence semantics stable enough to preserve?
* are the current anomaly types sufficient for real debugging and audit work?
* is the streaming behavior honest and understandable enough to preserve long-term?
* which domain-semantic behaviors are part of the core contract?
* which domain-semantic behaviors require extension hooks or policy interfaces?
* what should the library explicitly not claim before `1.0.0`?

Why this belongs here:

* these questions affect the long-term public contract more than they affect short-term developer ergonomics
* they are not just implementation tasks:
  * they influence anomaly types
  * they influence extension points
  * they influence what the library is allowed to claim publicly
* doing this work here reduces the risk of last-minute semantic churn near `1.0.0`

Exit criteria:

* the team would feel comfortable supporting the API long-term
* major semantic churn is no longer expected in the core release line
* the boundary between core semantics and domain-semantic extension behavior is explicit
* contradictory-event handling, entity-fork handling, and semantic dedupe across different IDs are each either:
  * designed clearly enough to implement before `1.0.0`, or
  * explicitly declared out of the `1.0.0` core claim surface

## `0.6.x` Operational Tooling And Integrations

Goal:
Make the library easier to operate inside real event pipelines, not just easier to understand in isolation.

Focus:

* add operational tooling around the core package without weakening the core semantics:
  * replay inspection helpers
  * anomaly summary helpers
  * explain-why-this-order debugging output
* add reference integration patterns for common deployment shapes:
  * local durable queue to later replay batch
  * immediate streaming plus periodic reconciliation
  * append-only downstream projections
  * mutable downstream projections
* add more concrete examples for:
  * database-backed event storage
  * broker or queue consumption
  * local file or disk-backed buffering
* add metrics-oriented guidance for:
  * watermark progress
  * late-arrival frequency
  * anomaly-rate monitoring
  * correction-rate monitoring

Exit criteria:

* the project includes practical patterns for fitting `causal-order` into real operational pipelines
* users can see how the same event model supports bounded replay, live streaming, and hybrid reconciliation
* maintainers have clearer tooling hooks for debugging and operator visibility

## `0.7.x` Ecosystem And Transferability

Goal:
Reduce dependence on any single team member and make the package easier for a broader team to carry forward safely.

Focus:

* strengthen transferability:
  * maintenance guide
  * release process guide
  * compatibility policy
  * clearer architecture notes for core modules
* improve ecosystem maturity:
  * better examples index and discovery
  * more explicit migration notes between release lines
  * clearer public guidance on supported versus intentionally unsupported usage
* add more public proof that the package solves real problems:
  * case-study expansion
  * benchmark reporting
  * operational walkthroughs
* make the project easier to evaluate for long-term adoption:
  * clearer upgrade expectations
  * clearer support expectations
  * clearer repository organization

Exit criteria:

* a new team member can understand how to evolve the package without relying on undocumented tribal knowledge
* the package feels transferable, not dependent on any single team member
* external evaluators can assess the project with less guesswork about intent and maintenance burden

## `0.8.x` Adoption And Transferability Maturity

Goal:
Make the package easier to adopt, evaluate, and carry forward as a stable technical asset.

Focus:

* improve adoption and evaluation signals:
  * stronger onboarding and evaluation flow
  * clearer operational positioning
  * clearer handoff and maintenance expectations
* strengthen trust for real adopters:
  * more polished public docs
  * more polished operator guidance
  * more polished public release discipline
* prepare the package for adjacent tooling and workflow layers without forcing them into the core package:
  * stronger operational inspection patterns
  * stronger reconciliation guidance
  * stronger anomaly analysis workflows
  * stronger extension points for future integrations

Exit criteria:

* the package is understandable not only to developers, but also to technical evaluators and maintainers
* the project reads like a reliable technical foundation for adoption and extension
* the maintainability and transferability story is strong enough that another team could extend it confidently

## `0.9.x` Final Stabilization Before `1.0.0`

Goal:
Confirm that the project should actually become a long-term stable public contract.

Focus:

* resolve any remaining ambiguity before `1.0.0`
* make final naming or compatibility decisions if anything still feels soft
* do a last pass over:
  * docs
  * examples
  * migration notes
  * operator guidance
  * release packaging
* confirm that the project says exactly what it means and does not overclaim beyond the implemented contract

Exit criteria:

* the team sees no major unresolved semantic or packaging question that should block `1.0.0`
* the project is ready for stable adoption without needing a conceptual rewrite

## `1.0.0` Stable Public Release

Goal:
Publish the first stable npm release.

Definition of done:

* core semantics are stable
* public API is intentional
* docs and examples are strong
* a public website exists for the current wiki content so the conceptual docs are easier to browse as a stable product surface
* tests are meaningful
* the package clearly solves a real event-integrity problem

`1.0.0` should mean:

* consumers can depend on the semantics
* breaking changes become exceptional
* the conceptual documentation has graduated from repo wiki pages into a real website suitable for long-term public reference
* the package is ready for real production evaluation

## Post-`1.0`

Possible directions after stability:

* optional `day-boundary` integration for civil-time grouping
* audit report helpers
* incident timeline helpers
* richer adapters
* optional integration helpers for `Temporal` at the edges, not the core
* performance tuning for large streaming workloads
* richer operational tooling and workflow layers built on top of the core, if they strengthen the event-integrity story

These should only happen if they strengthen the event integrity story.
The package should not drift into becoming a database, queue, tracing platform, or generic distributed systems framework.

## Tentative Ideas

These are not assigned to a release line yet.
They are here to capture potentially important directions without implying commitment, sequencing, or near-term scope.

### Future Ecosystem Packages

Once the core contract feels settled, one likely direction is to add ecosystem packages on top of the core runtime rather than folding those concerns into the core package itself.

That could include:

* `@causal-order/production`
* `@causal-order/kafka`
* `@causal-order/postgres`
* `@causal-order/replay-tools`
* `@causal-order/metrics`

These should stay tentative until the core runtime is stable enough that downstream packages are not forced to absorb semantic or operational churn from the center of the project.

### Confidence-Aware Operational Glue

Another tentative direction is to add confidence-aware operational glue on top of the core runtime rather than pushing it directly into the core package by default.

This could include things such as:

* confidence-grouped result helpers
* sink-policy helpers that reject or warn on `fallback` or `unknown`
* stricter operational wrappers for audit, replay, or projection workflows
* confidence-aware metrics or reporting helpers

The motivation is real:

* the core library can preserve uncertainty correctly
* downstream systems can still flatten that uncertainty away if they ignore confidence and anomaly semantics

But the right implementation shape is still open.
This may never belong in the core package itself.
It may fit better as higher-level glue or ecosystem packages once the core runtime is stable enough to build around safely.

### Public Docs Website

Another tentative direction is to keep building a public documentation site for `causal-order` ahead of `1.0.0`, without turning it into a release-track promise too early.

The main value would be:

* a friendlier public reading surface for the README, guides, and wiki
* a clearer conceptual entry point for developers who are new to the library
* a long-term home for examples, mental-model pages, and operational write-ups

The important constraint is that the website should not create a second duplicated docs tree inside the repo.
The source of truth should remain the existing documentation set, especially:

* `/guides`
* `/wiki`

The site layer can evolve as a separate app or publishing surface, but the content should continue to be authored once and rendered from that shared source.

This is a directional docs effort, not a core milestone promise.
It should become more serious closer to `1.0.0`, once the package contract and the documentation surface both feel settled enough to present publicly with confidence.

### Causal Timestamp API

One tentative direction is to design a smaller causal timestamp primitive that could sit beneath libraries like `causal-order`, or be used independently by runtimes, databases, storage engines, replication layers, and sync systems.

The appeal of this idea is not "another timestamp format."
The appeal would be a portable causal-time primitive that can be created, merged, compared, serialized, and interpreted honestly across environments that cannot rely on one globally synchronized clock.

If explored, this should stay intentionally small.
It should not turn into:

* a database protocol
* a tracing platform
* a CRDT framework
* a broad distributed-systems abstraction layer

The most promising shape would likely focus on a narrow contract such as:

* create or advance a causal timestamp
* receive or merge a remote timestamp
* compare two timestamps
* serialize and parse them safely
* explain whether a comparison represents causal proof, monotonic same-node progression, a weaker derived hint, or an honest inability to justify more

Why this might matter:

* many systems have wall-clock timestamps but no honest causal-time primitive
* a portable causal timestamp surface could be useful outside this library
* `causal-order` itself could eventually consume that primitive rather than being the only place the model lives

This idea should remain tentative until there is enough clarity on whether it is:

* a reusable low-level primitive
* a separately publishable library
* or simply an internal conceptual foundation for later work

## Success Criteria

This library is successful if developers stop saying:

```txt
we sorted by timestamp, so the timeline must be right
```

and start saying:

```txt
we know which event order is proven, which is inferred, and which is unknowable
```
