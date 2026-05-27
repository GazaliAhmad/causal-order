# `0.5.0` Migration Notes

These notes describe the non-breaking migration direction of the published `0.5.0` stability release.

The goal is to tell package users what they can already rely on, what names should be preferred going forward, and which advanced surfaces should still be treated cautiously before `1.0.0`.

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)
* [Decision Record: Default Behavior `0.5.0`](./decision-record-default-behavior-0.5.0.md)
* [Decision Record: Core Boundaries `0.5.0`](./decision-record-core-boundaries-0.5.0.md)

## Current Release Posture

The published npm line is now `0.5.0`.

These migration notes describe the compatibility direction of the released `0.5.0` stability work:

* preserve working behavior where the project already intends to keep it
* shift docs and examples toward clearer primary names
* avoid sudden removals while the package is still deciding pre-`1.0.0` contract edges

## Helper Names To Prefer

Prefer these names in new code:

* `compareByHlc()` for direct HLC comparison
* `compareDeterministically()` for deterministic fallback comparison

Compatibility posture:

* `compareClocks()` remains a compatibility alias for now
* `compareWithTieBreaker()` remains a compatibility alias for now
* the intended migration signal is deprecation guidance first, not abrupt removal

Practical advice:

* existing code using `compareClocks()` does not need an immediate rewrite to keep working
* existing code using `compareWithTieBreaker()` does not need an immediate rewrite to keep working
* new examples, new docs, and new package-facing integrations should prefer the clearer primary names now

## Defaults That Intentionally Stay Warning-Visible

The current compatibility direction preserves these default behaviors:

* `strict: false` remains the default
* `detectAnomalies: true` remains the default
* unresolved ordering stays visible in non-strict mode rather than being hidden by default
* translation optional-field handling remains warning-visible by default through `optionalFieldFailure: "warn"`

That means migration should not assume:

* stricter defaults are about to replace the warning-visible posture automatically
* disabling anomaly output creates a truer ordering result
* unresolved placement will start disappearing silently

## Translation Policy Reminder

Translation strictness is still configured separately from `orderEvents()` strictness.

Keep this split in mind:

* `orderEvents(..., { strict })` controls ordering and validation fail-fast behavior
* `translateBatch(..., { policy })` controls translation fail-fast or continuation behavior

For optional-field handling:

* `"warn"` keeps the omission or rejection visible by default
* `"continue"` is an explicit opt-in when omission-safe behavior is acceptable
* `"fail"` is an explicit opt-in when ingress should stop immediately

## Advanced Surface To Treat As Unstable

`orderValidatedEvents()` remains part of the public model, but the current `internal` coordination parameter should be treated as advanced or repo-coupled usage rather than as a stable long-term contract.

Practical advice:

* do not build new integrations around the current `internal` parameter shape unless you are intentionally depending on repo-adjacent behavior
* prefer the ordinary `orderEvents()` entrypoint unless you already have a strong validated-event pipeline need

## Future Semantic Policy Work

The current draft policy interfaces:

* `CausalContradictionPolicy`
* `ForkResolutionPolicy`
* `SemanticDedupePolicy`

should be read as extension-boundary shaping, not as a claim that the core runtime already resolves those semantic cases.

Migration implication:

* do not assume the core package will silently merge contradictions, choose canonical fork branches, or deduplicate business objects by itself
* keep domain resolution logic outside the core runtime unless later release notes explicitly publish a narrower supported contract

## Safe Near-Term Migration Summary

For the current `0.5.0` line, the safe migration posture is:

1. keep existing compatibility aliases working, but prefer the clearer primary helper names in new code
2. keep relying on warning-visible defaults unless your workflow explicitly needs fail-fast behavior
3. treat anomaly visibility as part of the ordinary contract, not as optional decoration
4. treat payload-aware contradiction, fork, and semantic-dedupe resolution as higher-layer policy work, not as current core-package behavior
