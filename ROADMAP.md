# Roadmap

This roadmap describes how `causal-order` should mature from its current public `0.2.x` release line into a stable `1.0.0` npm package.

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

* Node.js `20+`
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
* `orderBasis`, `causalEvidence`, anomaly types, concurrent groups, and strict-mode behavior feel intentional rather than exploratory
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
| `orderBasis`, `causalEvidence`, anomaly types, concurrent groups, and strict-mode behavior feel intentional rather than exploratory | Partial | Stronger than before, but concurrency grouping and some stream semantics still feel actively defined. |
| The difference between `orderEvents()` and `orderEventStream()` is clear in both code and docs | Partial | The boundary is clearer, but can still be made more explicit in the docs. |
| The README describes the real shipped package, not a still-evolving intended shape | Partial | The README is now npm-facing and package-oriented, but the broader documentation set still needs to feel fully settled as a long-term contract. |
| Examples clearly show why this library is safer than naive timestamp sorting | Partial | The examples are good and aligned to failure modes, but can still be made more central for `1.0`. |
| Performance guidance is honest about routine workloads, heavier batch workloads, and when streaming is the better model | Partial | This is much improved and grounded, but still relatively fresh. |
| Large-batch behavior has been benchmarked and pressure-tested enough that major surprises are unlikely in realistic use | Partial | Benchmarks and guardrails are now in place, but more repeated pressure would strengthen confidence further. |
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

### Consequence For `concurrentGroups`

`concurrentGroups` should only contain events that are truly concurrent under the supported model.

That means:

* some current groups may shrink
* some current groups may disappear
* this is acceptable if it removes false certainty

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

Success criteria:

* the repo has named benchmark coverage for these corruption-heavy patterns
* the repo has explicit stress profiles or fixtures covering duplicate pressure, inversion pressure, malformed ratios, sparse causality, timestamp clustering, replay storms, dependency cycles, and sequence conflicts
* maintainers can compare normal large-batch profiles against anomaly-heavy stress profiles
* any serious stress-path regressions are visible before later release lines
* follow-up performance work, if needed, can be scoped from real benchmark evidence rather than intuition

## `0.3.0` Next Milestone: Streaming Reality

Goal:
Make streaming claims believable.

Focus:

* improve `orderEventStream()`
* optimize the `flushReady()` path so repeated buffer scans and compaction do not become the next streaming performance cliff
* harden watermark behavior
* harden late-arrival policies:
  * `flag`
  * `drop`
  * `emit_correction`
  * `fail`
* define batch correction behavior more clearly
* test bounded-memory assumptions
* add backpressure guidance and implementation behavior
* document memory strategy with concrete examples

Why this is the next public milestone:

* `0.2.x` has now done the main semantics and corrupted-dataset stress hardening work it needed to do
* the most important remaining credibility questions are now on the streaming path, not the large-batch path
* promoting this to `0.3.0` keeps the version story honest:
  * `0.2.0` was the published semantics-hardening baseline
  * `0.2.1` was an internal intermediate repo step
  * `0.2.2` was the stress-hardening release
  * `0.3.0` is the next meaningful behavioral milestone

Exit criteria:

* streaming behavior matches the documented policy
* late events are never hidden by accident
* bounded-memory operation is demonstrated, not implied

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

## `0.5.x` Stability Candidate

Goal:
Decide whether the API is truly ready to become a stable public contract.

Focus:

* remove avoidable naming ambiguity
* review all exported types for long-term stability
* review default behaviors carefully
* identify anything still experimental and either remove it or mark it clearly
* add compatibility and migration notes
* expand test coverage around public surface area

Questions to answer before `1.0.0`:

* are confidence semantics stable enough to preserve?
* is `CausalEvidence` expressive enough?
* is streaming behavior honest and understandable?
* are anomaly types sufficient for debugging and audits?
* are the docs strong enough to prevent misuse?

Exit criteria:

* the team would feel comfortable supporting the API long-term
* major semantic churn is no longer expected

## `1.0.0` Stable Public Release

Goal:
Publish the first stable npm release.

Definition of done:

* core semantics are stable
* public API is intentional
* docs and examples are strong
* tests are meaningful
* the package clearly solves a real event-integrity problem

`1.0.0` should mean:

* consumers can depend on the semantics
* breaking changes become exceptional
* the package is ready for real production evaluation

## Post-`1.0`

Possible directions after stability:

* optional `day-boundary` integration for civil-time grouping
* audit report helpers
* incident timeline helpers
* richer adapters
* optional integration helpers for `Temporal` at the edges, not the core
* performance tuning for large streaming workloads

These should only happen if they strengthen the event integrity story.
The package should not drift into becoming a database, queue, tracing platform, or generic distributed systems framework.

## Success Criteria

This library is successful if developers stop saying:

```txt
we sorted by timestamp, so the timeline must be right
```

and start saying:

```txt
we know which event order is proven, which is inferred, and which is unknowable
```
