# `0.3.3` Streaming Hardening And Pressure

`0.3.3` is the milestone where `causal-order` widens the streaming pressure envelope after the current `0.3.2` contract has already been defended as production-credible.

This guide is not a new semantic contract.
It is the scoped hardening and pressure plan for the next release step.

## Goal

Before `0.3.3` is called complete, the repository should be able to defend a simple claim:

> the current streaming contract is not only semantically credible, but also pressure-tested more deeply under sustained reconnect, watermark, correction, and bounded-memory stress

That is different from claiming the library now solves new domain-semantic problems.
It means the current streaming model has been exercised under heavier pressure and better hotspot evidence.

## What This Milestone Is

`0.3.3` is about:

* broader streaming pressure coverage beyond the `0.3.2` minimum gate
* follow-up optimization where profile evidence shows real pressure cliffs
* longer-running exploratory seeded fuzz campaigns
* correction-window churn and watermark-lag pressure
* bounded-memory and backpressure hardening under heavier load
* clearer evidence for which stream stress cases deserve future enforced perf guards

`0.3.3` is not about redefining the meaning of `proven`, `derived`, `fallback`, `unknown`, or stream finality.

## Why This Follows `0.3.2`

`0.3.2` is the release gate.
It proves the current core and streaming contract is already credible enough to defend.

`0.3.3` follows that gate so the repository can widen the pressure work without blurring the release story.

That sequencing matters:

* first prove the current claims
* then harden the pressure envelope around those claims

For the current release gate, see:

* [Production Gate `0.3.2`](./production-gate-0.3.2.md)
* [Fuzz Testing `0.3.2`](./fuzz-testing-0.3.2.md)

## Pressure Areas

The current `0.3.3` pressure scope is:

* `flushReady()` follow-up optimization
* anomaly-heavy batch and stream hotspot tightening
* broader streaming stress coverage beyond the current release-gate set
* longer-running seeded exploratory fuzz campaigns
* correction-window churn and delayed reconnect pressure
* sustained watermark-lag and flush-fragmentation pressure
* bounded-memory and backpressure hardening under heavier stress
* deciding which additional stream stress profiles should become future perf guards

Each area should produce either:

* stronger guarded coverage
* clearer profile-backed evidence
* or a more honest documented limit

## `flushReady()` Follow-Up Work

The `0.3.0` through `0.3.2` line already made the stream path real and production-defensible.

`0.3.3` should continue the follow-up work on the `flushReady()` path so that:

* repeated scans do not become the next throughput cliff
* buffer compaction cost stays visible and controlled
* ready-subset emission under lagging watermarks remains efficient
* correction-triggered flush behavior stays understandable under heavier reconnect churn

The goal is not micro-optimization for its own sake.
The goal is to prevent the next streaming hotspot from hiding behind otherwise-correct semantics.

## Anomaly-Heavy Path Work

The next pressure layer is not only about clean streaming flow.
It is also about ugly operational volume.

`0.3.3` should continue profiling and tightening anomaly-heavy paths where:

* repeated anomaly allocation creates GC pressure
* large invalid-event or duplicate-event volume reduces throughput sharply
* anomaly-rich replay or reconnect batches make batch and stream behavior meaningfully slower than their cleaner equivalents

This includes both:

* stream-focused hotspots
* anomaly-heavy batch paths that still feed the same operational story

## Exploratory Fuzz Expansion

The `0.3.2` fuzz layer is the bounded, reproducible release-gate suite.

`0.3.3` should extend that into broader exploratory campaigns such as:

* longer-running seeded runs
* higher-cardinality workloads
* stronger concurrency storms
* more sustained reconnect backlogs
* heavier correction-window churn
* watermark-lag and memory-growth discovery runs

These runs should be treated as:

* hotspot-discovery tooling
* pressure evidence
* repeatable stress exploration

They should not replace the named `0.3.2` release-gate suite as the primary correctness gate for the current contract.

## Correction-Window And Reconnect Pressure

Small semantic fixtures already show that delayed reconnect and `emit_correction` work.

`0.3.3` should push further by testing:

* repeated correction-trigger batches in one stream instance
* reconnect bursts that fragment output into many batches
* delayed device or node uploads that keep forcing correction-capable flushes
* operational churn where correction scope stays visible without becoming silently unbounded in practice

The goal here is not to promise a richer correction model than the current contract.
It is to prove the current correction model stays usable under heavier reconnect pressure.

## Watermark And Bounded-Memory Pressure

`0.3.2` covers watermark correctness and minimum bounded-memory credibility.

`0.3.3` should extend that into heavier pressure cases such as:

* sustained watermark lag
* repeated lagging-watermark flush attempts
* large buffered windows with only a partial ready subset
* stronger backpressure visibility when ready output and buffered backlog diverge
* heavier stress around nominal `batchSize` fragmentation and non-fragmentation behavior

The important question is not only:

* is the watermark rule correct?

It is also:

* does the current contract remain operationally understandable under heavier pressure?

## Perf-Guard Decision Work

Not every stress profile should become a permanent enforced guard immediately.

`0.3.3` should decide which additional stream stress cases are mature enough to move from:

* exploratory visibility

to:

* enforced perf-check expectation

That decision should be evidence-driven.

Profiles should become guarded only when:

* they are reproducible
* they reflect a meaningful operational risk
* their variability is low enough to make a guard useful rather than noisy

## Optimization Discipline

`0.3.3` should keep optimization decisions evidence-driven.

That means:

* retain optimizations that measurably improve guarded or stressed workloads
* avoid keeping micro-optimizations that add code complexity without meaningful wins
* let CPU profiles, GC behavior, and repeated stress runs choose the next hotspot

The milestone should value honest evidence over optimization folklore.

## Verification Commands

The `0.3.3` work should still map back to repository commands rather than only to prose.

Current commands that should carry this work are:

```bash
npm test
npm run bench
npm run bench:stream
npm run bench:check
npm run bench:profile
npm run release:check
```

As the scoped work lands, the repository should make it easier to tell which of these commands provide:

* current release-gate proof
* exploratory pressure evidence
* guarded performance regression detection

## Docs And Release Wording

By the end of `0.3.3`, the repository should make one consistent claim about what this release means.

That includes:

* README wording
* guides
* roadmap references
* changelog and release notes
* perf-check expectations

The wording should stay disciplined:

* `0.3.2` is the production-credibility gate
* `0.3.3` is the broader streaming hardening and pressure follow-up

If the heavier pressure evidence is still incomplete, the wording should reflect that rather than implying a closed hotspot story.

## Not In Scope Yet

`0.3.3` does not try to solve:

* contradictory domain events
* entity fork semantics
* semantic duplicate detection for different event IDs that represent the same action
* a new domain-aware merge or correction policy layer
* a fundamentally different stream finality model

Those belong to later contract and extension-point design work, not to this pressure-expansion milestone.

## Exit Criteria

`0.3.3` is complete when:

* broader streaming pressure coverage exists beyond the minimum `0.3.2` release-gate set
* the most important remaining streaming hotspots have fresh profile-backed evidence
* bounded-memory and backpressure behavior are not only documented, but exercised under stronger pressure conditions
* maintainers have clearer evidence for which streaming stress cases should become future enforced guards
* docs and release wording keep the distinction clear between production-gate proof and broader pressure-follow-up hardening
