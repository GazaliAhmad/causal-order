# `0.5.0` Decision Record: API Clarity

This note records the first explicit `0.5.0` API-clarity decisions for the published line.

It is narrower than the full surface inventory.
Its job is to turn the first three high-priority review items into concrete release decisions that the rest of the documentation and migration notes build on.

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Exported Surface Inventory `0.5.0`](./exported-surface-inventory-0.5.0.md)

## Scope

This decision record covers:

1. `compareByHlc()` versus `compareClocks()`
2. `applyTieBreaker()` versus `compareDeterministically()` versus `compareWithTieBreaker()`
3. `orderValidatedEvents()` exposing a public `internal` parameter

It does not replace the implementation itself.
It defines the direction the published `0.5.0` line follows.

## Decision 1: HLC Comparison Naming

Decision:

* preserve `compareByHlc()` as the primary long-term public name
* treat `compareClocks()` as compatibility surface rather than as the preferred public name

Why:

* `compareByHlc()` says exactly what mechanism is being used
* `compareClocks()` is shorter, but broader-sounding and easier to read as a more general semantic promise
* both names currently point at the same basic concept, so keeping both as equally preferred names adds ambiguity without adding real capability

Compatibility posture:

* `0.5.0` keeps `compareClocks()` working unless there is a deliberate breaking-change decision
* docs, examples, and API emphasis shift toward `compareByHlc()`
* the preferred first-step migration signal is JSDoc `@deprecated`, not immediate removal
* the published line leaves room for a later release to decide whether `compareClocks()` becomes:
  * a documented compatibility alias
  * a deprecated alias
  * a pre-`1.0` removal candidate

Proposed migration wording:

`compareByHlc()` is the preferred public helper for direct HLC-to-HLC comparison.
If you currently use `compareClocks()`, no immediate behavioral change is required, but new code and docs should prefer `compareByHlc()`.

## Decision 2: Deterministic Comparison Layer

Decision:

* preserve `compareDeterministically()` as the primary user-facing helper
* treat `applyTieBreaker()` as a lower-level helper only if the package intentionally wants that lower-level concept public
* review `compareWithTieBreaker()` as the strongest deprecation or alias-removal candidate in this group

Why:

* three overlapping public names in one narrow layer create unnecessary cognitive load
* `compareDeterministically()` best communicates the public semantic job
* `applyTieBreaker()` sounds more mechanical and implementation-adjacent
* `compareWithTieBreaker()` overlaps heavily with the more general deterministic-comparison story

Compatibility posture:

* `0.5.0` centers docs and examples on `compareDeterministically()`
* `0.5.0` explicitly classifies:
  * whether `applyTieBreaker()` is intentionally public low-level API
  * whether `compareWithTieBreaker()` exists for real public value or only because the surface accreted in layers
* the preferred first-step migration signal for `compareWithTieBreaker()` is JSDoc `@deprecated`, not immediate removal
* no runtime removal is required in the same release line as the decision record

Proposed migration wording:

`compareDeterministically()` is the preferred public helper when stronger causal proof is unavailable and deterministic ordering is still required.
If you currently use `compareWithTieBreaker()`, migrate toward `compareDeterministically()` unless a later release explicitly preserves both as separate supported concepts.

For `applyTieBreaker()`, migration depends on the later classification decision:

* if retained as public low-level API, document it that way
* if not, steer callers to `compareDeterministically()`

## Decision 3: `orderValidatedEvents()` Signature Boundary

Decision:

* preserve `orderValidatedEvents()` as a public concept
* do not preserve the current `internal` parameter as part of the intended `1.0.0` stable contract unless a stronger justification appears

Why:

* ordering already validated events is a real, understandable public need
* the current extra parameter shape reads like implementation plumbing:
  * `sourceEvents`
  * `validations`
  * `anomalies`
  * `invalidEvents`
* that bag exposes internal coordination details more than domain-level contract

Compatibility posture:

* `0.5.0` treats the current signature as review surface, not as preserve-by-default contract
* the preferred direction is to narrow the public signature before `1.0.0`
* until that narrower shape exists, the current parameter remains available and is documented as repo-coupled rather than deleted abruptly
* if internal coordination hooks still matter, they should move behind:
  * repo-internal wiring
  * non-exported helpers
  * or a separately justified advanced surface

Proposed migration wording:

`orderValidatedEvents()` remains part of the intended public ordering model, but the current `internal` coordination parameter should not be treated as stable long-term contract.
Code that depends on that parameter should be treated as advanced or repo-coupled usage pending a narrower public signature decision.

## Released `0.5.0` Follow-Through

These decisions shaped the released follow-through:

1. docs emphasis moved toward `compareByHlc()` and `compareDeterministically()`
2. `compareClocks()` and `compareWithTieBreaker()` stayed as documented compatibility aliases with deprecation guidance
3. the `orderValidatedEvents()` support shape was isolated so the public contract can narrow later without abrupt runtime churn
4. focused migration notes landed alongside the release

## Non-Goals

This note does not yet decide:

* exact deprecation mechanics
* whether any alias emits runtime warnings
* exact replacement signature for `orderValidatedEvents()`
* broader semantic questions around contradiction handling, forks, or semantic dedupe

Those are handled by the rest of the published `0.5.0` documentation set or by later `0.6.x` work.
