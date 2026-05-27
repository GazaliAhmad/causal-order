# `0.5.0` Milestone Summary

`0.5.0` is now the published stability-and-contract-design release rather than a loose future-ideas bucket.

This note is the short repo-local summary of what `0.5.0` settled as a published line and what it intentionally did not expand.

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Migration Notes `0.5.0`](./migration-notes-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)
* [Decision Record: Default Behavior `0.5.0`](./decision-record-default-behavior-0.5.0.md)
* [Decision Record: Core Boundaries `0.5.0`](./decision-record-core-boundaries-0.5.0.md)

## What `0.5.0` Settled

The milestone now has explicit artifacts for all five original chunks:

1. exported-surface and naming audit
2. default-behavior and compatibility inventory
3. domain-semantic boundary notes
4. core-versus-extension-versus-out-of-scope decisions
5. migration notes and targeted stability-surface tests

That means `0.5.0` is no longer only an intention in the roadmap.
It is now a concrete contract-shaping line in the repo.

## Main Decisions

The current `0.5.0` line now clearly says:

* prefer `compareByHlc()` and `compareDeterministically()` as the primary helper names
* keep `compareClocks()` and `compareWithTieBreaker()` as compatibility surface for now rather than deleting them abruptly
* preserve warning-visible defaults such as `strict: false`, `detectAnomalies: true`, and translation optional-field `"warn"` posture
* treat `allowUnknownOrder` as severity and uncertainty-governance surface, not as permission to invent stronger certainty
* keep contradiction resolution, fork resolution, and semantic dedupe action outside the payload-agnostic core runtime
* preserve operator visibility as a hard compatibility direction

## What `0.5.0` Explicitly Does Not Claim

`0.5.0` does not claim that the package already:

* resolves contradictory events automatically
* chooses canonical entity fork branches automatically
* deduplicates business objects correctly by itself
* treats the current `orderValidatedEvents()` `internal` parameter as a stable long-term public contract

Those areas remain either extension-hook territory, later design work, or intentionally out of scope for the current core claim surface.

## Release Posture

The published `0.5.0` line can now say:

* the public naming direction is explicit
* the preserved defaults are explicit
* the payload-agnostic core boundary is explicit
* migration guidance exists before removal or narrowing work
* the preserved behavior is covered by focused tests rather than only prose

That is the main release value of this milestone.

## Remaining Work After Publication

After publishing this milestone, the repo should still do ongoing follow-through across:

* `CHANGELOG.md`
* `README.md`
* website API and guide navigation
* release-version metadata
* any final non-breaking implementation polish that the current decision records still imply

That follow-through should be release discipline work, not a reopening of the `0.5.0` contract questions.

## Short Status

As a published repo milestone, `0.5.0` is now coherently scoped and documented.

The next decision is no longer "what does `0.5.0` mean?"
The next decision is no longer whether to publish it.
The next decision is how to begin the `0.6.x` implementation line from the now-explicit extension boundaries.
