# Production Gate

This guide defines the current production gate for `causal-order`.

This guide is not a feature roadmap.
It is the release gate for the current docs line.

## Goal

Before the current docs line is called production-credible, the repository should be able to defend a simple claim:

> the current core and streaming semantics are explicit, directly tested, operationally honest, and stable enough to trust under the failure shapes they already claim to support

That is different from claiming the library solves every distributed-event problem.
It means the current contract is strong enough to defend on its own terms.

## What This Production Gate Covers

The current production gate is about:

* explicit release gates
* direct pass/fail coverage for the current contract
* determinism as a release requirement
* streaming pressure coverage where it supports the already-shipped model
* docs and release wording that do not outrun test evidence

This gate is not about adding a new semantic layer.

## Release-Blocking Categories

The current core gate categories are:

* missing parent events
* offline device merge
* duplicate event storms for exact duplicate IDs
* clock reset scenarios
* massive out-of-order replay
* partial log corruption

Each category should end with explicit pass/fail assertions rather than only descriptive scenario coverage.

## Determinism Requirements

The current docs line should treat determinism as a hard requirement.

For the covered categories:

* the same input must produce the same ordered output
* the same input must produce the same anomaly output
* shuffled arrival order must not change causally justified conclusions

This does not mean every event set becomes globally ordered.
It means the honesty model should be stable and repeatable.

## Streaming Pressure Requirements

The current gate also has to show that the streaming contract is operationally credible under pressure where that pressure directly supports already-shipped semantics.

The required pressure areas are:

* pathological late arrivals
* reconnect correction pressure
* watermark pressure
* lagging-watermark plus `batchSize` pressure
* bounded-memory and backpressure behavior

This is not the broader streaming hardening follow-through.
It is the minimum pressure evidence needed to defend the streaming contract honestly.

## Anomaly Surface Requirement

The current anomaly surface should be sufficient for these gate categories.

If a gate category cannot be expressed honestly with the current anomaly model, one of two things should happen:

* add the missing core signal if it still fits the payload-agnostic core
* make the limitation explicit instead of implying that the signal already exists

The goal is not to invent domain-aware semantics.
The goal is to make the current core claims auditable.

For the current audit of that surface, see:

* [Anomaly Surface Audit](./anomaly-surface-0.3.2.md)
* [Fuzz Testing](./fuzz-testing-0.3.2.md)

## Verification Commands

The current production gate should be backed by repository commands, not only by prose.

Verification commands for the current gate:

```bash
npm run check
npm test
npm run bench:check
npm run release:check
```

As the gate matures, the release gate should become easier to map directly to these commands and to the tests they cover.

The seeded fuzz suite is now part of that production-gate evidence rather than only a future roadmap item.

## Docs And Release Wording

By the end of this gate, the repository should make one consistent claim about what is production-credible today.

That includes:

* README wording
* guides
* roadmap references
* changelog and release notes
* perf-check expectations

If the test evidence is narrower than the wording, the wording should shrink before the release claim grows.

## Not In Scope Yet

This gate does not try to solve:

* contradictory domain events
* entity fork semantics
* semantic duplicate detection for different event IDs that represent the same action

Those problems matter, but they require domain-aware policy or extension-point design rather than only more pressure on the payload-agnostic core.

## Exit Criteria

The production gate is complete when:

* the repo contains an explicit production-gate document for the current docs line
* the core gate categories have direct automated coverage with release-blocking assertions
* determinism is explicitly tested across repeated runs and shuffled inputs for the covered categories
* streaming pressure behavior is covered strongly enough that the streaming contract is operationally credible rather than only conceptually described
* docs and release wording do not claim more than the tested core semantics can honestly support
