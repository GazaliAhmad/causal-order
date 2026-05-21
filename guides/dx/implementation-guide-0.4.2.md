# `0.4.2` Implementation Guide

This note records the `0.4.2` work in a scoped, commit-friendly shape.

The important sequencing for `0.4.2` is:

* make the ingress contract genuinely teachable first
* prove the examples are runnable second
* tighten quick-start and policy guidance only after the examples settle

For the broader milestone intent, see:

* [ROADMAP `0.4.x`](../../ROADMAP.md)
* [Developer Experience `0.4.x`](./developer-experience-0.4.x.md)

## Working Rule

`0.4.2` should treat examples and docs as proof work for the `0.4.0` and `0.4.1` contract surfaces, not as a broad documentation refresh.

If the ingress and diagnostic contracts are now public surface, `0.4.2` should show that a new user can actually learn and evaluate those surfaces through the core package alone.

This work should stay split between a few clearly different kinds of DX work:

* self-contained example coverage
* quick-start scenario guidance
* strict-mode and late-arrival policy guidance
* docs-to-example synchronization
* docs and release wording

The repo should avoid turning that into one broad docs sweep.

The examples matter here because they are the first place where a new user should be able to touch the current package honestly.
If the repo updates guidance and README language before the examples are believable, the release line will look cleaner than it actually is.

## Sub-Goal

`0.4.2` should prove that the current core package is teachable and directly evaluable from the repository without pushing file-format glue or environment orchestration into the core API.

That means the repo should stay careful about what “self-contained” means:

* do not start by adding JSONL loaders or local file shells
* do not start by moving companion-tooling concerns into the core repo
* do start by making the current public API easier to understand through runnable native-Node examples and stronger package-facing docs

At this stage, the main question is simple:

* can someone clone the repo, run the examples, and understand the real package entry path without needing a second repo or a private mental model?

This milestone is about executable guidance for the core package, not about absorbing companion CLI responsibilities.

## Chunk Order

The intended landing order is:

1. self-contained core examples that exercise the ingress and ordering flow directly
2. quick-start scenario guidance for audit, replay, debugging, and offline-sync evaluation
3. stricter-mode and late-arrival policy guidance
4. README and docs synchronization checks against live examples
5. docs and release wording

The early chunks should answer the onboarding questions first:

* can a new user run a realistic example without building a glue layer first?
* do the examples show the true package path from raw records into ordering?
* do the examples teach the mental shift from timestamp sorting to causal honesty?
* is it clear when stricter fail-fast behavior is the safer operational choice?
* do the README and guides stay aligned with what the runnable examples actually show?

Only after that guidance is stable should the repo enforce tighter synchronization checks or make stronger “quick-start” claims.

At a good `0.4.2` stopping point, the package should feel easier to evaluate on its own terms:

* the examples run cleanly
* the examples demonstrate the real ingress contract rather than hiding it behind repo-local helpers
* the docs reflect what the examples actually do
* strict-mode guidance feels operational rather than vague
* the repo still has not drifted into companion-tooling responsibilities

The key is that `0.4.2` should prove the contract is teachable, not just described.

## Example Rule

Examples must not define shadow abstractions.

That means example code should not introduce helper functions, wrappers, or adapter layers that make users depend on a fake package shape that does not actually exist in the public API.

Examples should expose the real package surface directly:

* the real translation entry point
* the real ordering entry point
* the real anomaly and policy surfaces

Small setup helpers are fine when they stay obviously local and non-contractual.
What `0.4.2` should avoid is any example structure that teaches users to think the package has a smoother abstraction than it really exports.

If an example needs too much wrapper code to stay readable, that is usually evidence that the public package shape still needs work rather than evidence that the example should hide the complexity.

## Things To Avoid

Avoid combining these in one commit:

* new examples plus new file-format adapters
* quick-start guidance plus companion CLI work
* docs synchronization checks plus unrelated API redesign
* strict-mode guidance plus unverified operational claims
* docs wording plus examples that have not been run end-to-end

Avoid making these decisions accidentally:

* whether examples use the real public ingress path or hidden helper abstractions
* whether examples define shadow abstractions that users may mistake for package contract
* whether quick-start guidance reflects current public behavior or desired future behavior
* whether strict-mode recommendations are based on actual package semantics or only aspirational wording
* whether docs synchronization checks validate real examples or only copied snippets
* whether the repo quietly reintroduces companion-tooling concerns while trying to make onboarding easier
