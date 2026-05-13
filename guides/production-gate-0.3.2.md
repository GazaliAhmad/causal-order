# `0.3.2` Production Gate

`0.3.2` is the milestone where `causal-order` proves the settled `0.3.1` contract is production-credible before the scope expands again.

This guide is not a feature roadmap.
It is the release gate for the current release line.

## Goal

Before `0.3.2` is called production-credible, the repository should be able to defend a simple claim:

> the current core and streaming semantics are explicit, directly tested, operationally honest, and stable enough to trust under the failure shapes they already claim to support

That is different from claiming the library solves every distributed-event problem.
It means the current contract is strong enough to defend on its own terms.

## What This Milestone Is

`0.3.2` is about:

* explicit release gates
* direct pass/fail coverage for the current contract
* determinism as a release requirement
* streaming pressure coverage where it supports the already-shipped model
* docs and release wording that do not outrun test evidence

`0.3.2` is not about adding a new semantic layer.

## Release-Blocking Categories

The current-core gate categories for `0.3.2` are:

* missing parent events
* offline device merge
* duplicate event storms for exact duplicate IDs
* clock reset scenarios
* massive out-of-order replay
* partial log corruption

Each category should end with explicit pass/fail assertions rather than only descriptive scenario coverage.

## Determinism Requirements

The current release line should treat determinism as a hard requirement.

For the covered categories:

* the same input must produce the same ordered output
* the same input must produce the same anomaly output
* shuffled arrival order must not change causally justified conclusions

This does not mean every event set becomes globally ordered.
It means the current honesty model should be stable and repeatable.

## Streaming Pressure Requirements

`0.3.2` also has to show that the current streaming contract is operationally credible under pressure where that pressure directly supports already-shipped semantics.

The required pressure areas are:

* pathological late arrivals
* reconnect correction pressure
* watermark pressure
* lagging-watermark plus `batchSize` pressure
* bounded-memory and backpressure behavior

This is not the broader `0.3.3` pressure expansion.
It is the minimum pressure evidence needed to defend the current streaming contract honestly.

## Anomaly Surface Requirement

The current anomaly surface should be sufficient for the `0.3.2` gate categories.

If a gate category cannot be expressed honestly with the current anomaly model, one of two things should happen:

* add the missing current-core signal if it still fits the payload-agnostic core
* make the limitation explicit instead of implying that the signal already exists

The goal is not to invent domain-aware semantics.
The goal is to make the current core claims auditable.

For the current audit of that surface, see:

* [Anomaly Surface Audit `0.3.2`](./anomaly-surface-0.3.2.md)

## Verification Commands

The current release gate should be backed by repository commands, not only by prose.

Current verification commands:

```bash
npm run check
npm test
npm run bench:check
npm run release:check
```

As `0.3.2` progresses, the release gate should become easier to map directly to these commands and to the tests they cover.

## Docs And Release Wording

By the end of `0.3.2`, the repository should make one consistent claim about what is production-credible today.

That includes:

* README wording
* guides
* roadmap references
* changelog and release notes
* perf-check expectations

If the test evidence is narrower than the wording, the wording should shrink before the release claim grows.

## Not In Scope Yet

`0.3.2` does not try to solve:

* contradictory domain events
* entity fork semantics
* semantic duplicate detection for different event IDs that represent the same action

Those problems matter, but they require domain-aware policy or extension-point design rather than only more pressure on the current payload-agnostic core.

## Exit Criteria

`0.3.2` is complete when:

* the repo contains an explicit production-gate document for the current release line
* the current-core gate categories have direct automated coverage with release-blocking assertions
* determinism is explicitly tested across repeated runs and shuffled inputs for the covered categories
* streaming pressure behavior is covered strongly enough that the current streaming contract is operationally credible rather than only conceptually described
* docs and release wording do not claim more than the tested current-core semantics can honestly support
