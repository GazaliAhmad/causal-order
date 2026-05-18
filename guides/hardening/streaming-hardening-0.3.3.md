# Streaming Hardening And Pressure

`0.3.3` is the release where `causal-order` widens the streaming pressure envelope after the current `0.3.2` contract has already been defended as production-credible.

This guide records the shipped `0.3.3` hardening step.
It does not define a new semantic contract.

## Goal

`0.3.3` defends a simple claim:

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

## Sub-Goal: Memory Pressure Visibility

`0.3.3` makes stream memory pressure observable before making it enforceable.

This does not mean `0.3.3` begins with a stream-architecture redesign.

It means the repository should expose clearer memory-pressure truth for the current contract before it tries to:

* enforce memory-oriented perf guards
* make strong bounded-memory claims
* or justify deeper stream-path redesign from intuition alone

This matters when:

* reconnect storms keep large windows alive
* watermark lag stalls readiness progress
* correction churn keeps forcing frequent flush decisions
* partial ready subsets leave large pending state behind

If that pressure is operationally important, it should be visible even before it becomes a guarded benchmark surface.

So `0.3.3` treats memory in two layers:

* optimization evidence
* operational contract visibility

The release strengthens the second layer without pretending it already has stable enough numbers to enforce broadly in CI.

For the current benchmark tooling, that visibility includes simple observable signals such as:

* start, end, and peak heap
* peak RSS
* best-effort GC event counts and durations

Those numbers remain descriptive for now rather than treated as hard release thresholds.

Current local evidence for this sub-goal is encouraging but still observational.
Using `--expose-gc` with the `streaming-150k-watermark-lag` and `streaming-250k-watermark-lag` profiles, the measured heap growth during the run was reclaimed cleanly after an explicit forced GC.
That is useful evidence that the larger `0.3.3` stream-pressure profiles are exercising transient working-set growth rather than showing an obvious retained-heap leak.

That evidence should not be promoted to a hard guard yet.
It is still a local visibility signal, not a stable CI threshold.

## Why This Follows `0.3.2`

`0.3.2` is the release gate.
It proves the current core and streaming contract is credible enough to defend.

`0.3.3` follows that gate so the repository can widen the pressure work without blurring the release story.

That sequencing matters:

* first prove the current claims
* then harden the pressure envelope around those claims

For the current release gate, see:

* [Production Gate `0.3.2`](./production-gate-0.3.2.md)
* [Fuzz Testing `0.3.2`](./fuzz-testing-0.3.2.md)

## Pressure Areas

The shipped `0.3.3` pressure scope is:

* `flushReady()` follow-up optimization
* anomaly-heavy batch and stream hotspot tightening
* broader streaming stress coverage beyond the current release-gate set
* longer-running seeded exploratory fuzz campaigns
* correction-window churn and delayed reconnect pressure
* sustained watermark-lag and flush-fragmentation pressure
* bounded-memory and backpressure hardening under heavier stress
* deciding which additional stream stress profiles should become future perf guards

Each area produces either:

* stronger guarded coverage
* clearer profile-backed evidence
* or a more honest documented limit

The same principle applies to memory pressure:

* first make it observable
* then decide later which parts are stable enough to guard

For stream stress scale, the released `0.3.3` posture stays explicit:

* `100k` remains the routine comparison band
* `150k` is the main stream stress-visibility band for broader `0.3.3` pressure work
* `250k` is an exploratory stretch band, not a routine guard target

## `flushReady()` Follow-Up Work

`0.3.3` continued the follow-up work on the `flushReady()` path so that:

* repeated scans do not become the next throughput cliff
* buffer compaction cost stays visible and controlled
* ready-subset emission under lagging watermarks remains efficient
* correction-triggered flush behavior stays understandable under heavier reconnect churn

The goal is to keep a known hotspot visible and measurable under heavier pressure.

## Anomaly-Heavy Path Work

`0.3.3` continued profiling and tightening anomaly-heavy paths where:

* repeated anomaly allocation creates GC pressure
* large invalid-event or duplicate-event volume reduces throughput sharply
* anomaly-rich replay or reconnect batches make batch and stream behavior meaningfully slower than their cleaner equivalents

This includes both:

* stream-focused hotspots
* anomaly-heavy batch paths that still feed the same operational story

The current hardening pass now includes a lighter single-event anomaly path for invalid stream records and a cheaper pending-anomaly merge path in `orderEventStream()`, so anomaly-heavy stream pressure is paying less overhead for obviously local anomaly cases.

## Exploratory Fuzz Expansion

The `0.3.2` fuzz layer is the bounded, reproducible release-gate suite.

`0.3.3` extends that into broader exploratory campaigns such as:

* longer-running seeded runs
* higher-cardinality workloads
* stronger concurrency storms
* more sustained reconnect backlogs
* heavier correction-window churn
* watermark-lag and memory-growth discovery runs

These runs should be treated as repeatable pressure evidence and hotspot-discovery tooling.

The current exploratory layer now includes seeded stream fuzz coverage for:

* fragmented watermark-lag pressure
* correction-burst pressure
* sustained correction-churn pressure
* fragmented reconnect-burst pressure
* bounded-window lagging-watermark pressure
* bounded-memory cross-window replay pressure

They should not replace the named `0.3.2` release-gate suite as the primary correctness gate for the current contract.

## Correction-Window And Reconnect Pressure

Small semantic fixtures already show that delayed reconnect and `emit_correction` work.

`0.3.3` pushes further by testing:

* repeated correction-trigger batches in one stream instance
* reconnect bursts that fragment output into many batches
* delayed device or node uploads that keep forcing correction-capable flushes
* operational churn where correction scope stays visible without becoming silently unbounded in practice

The goal is to show that the current correction model stays usable under heavier reconnect pressure.

## Watermark And Bounded-Memory Pressure

`0.3.2` covers watermark correctness and minimum bounded-memory credibility.

`0.3.3` extends that into heavier pressure cases such as:

* sustained watermark lag
* repeated lagging-watermark flush attempts
* large buffered windows with only a partial ready subset
* stronger backpressure visibility when ready output and buffered backlog diverge
* heavier stress around nominal `batchSize` fragmentation and non-fragmentation behavior

The question is not only whether the watermark rule is correct, but whether the current contract remains operationally understandable under heavier pressure. That includes memory behavior.

For this milestone, the repo does not need to pretend memory is already a settled hard guard surface.
But it should make the memory consequences of stalled or fragmented streaming behavior much more visible than they are today.

## Perf-Guard Decision Work

`0.3.3` decides which additional stream stress cases are mature enough to move from:

* exploratory visibility

to:

* enforced perf-check expectation

That decision is evidence-driven.

Profiles become guarded only when:

* they are reproducible
* they reflect a meaningful operational risk
* their variability is low enough to make a guard useful rather than noisy

At the released stage, `streaming-150k-watermark-lag` is strong enough to serve as the enforced `0.3.3` stream-pressure guard.
The `250k` watermark-lag profile remains exploratory, and the correction-churn profile remains evidence-oriented until it proves stable enough for routine CI use.

## Optimization Discipline

`0.3.3` keeps optimization decisions evidence-driven.

That means:

* retain optimizations that measurably improve guarded or stressed workloads
* avoid keeping micro-optimizations that add code complexity without meaningful wins
* let CPU profiles, GC behavior, and repeated stress runs choose the next hotspot

The milestone prefers measured evidence over assumptions.

## Verification Commands

The `0.3.3` work still maps back to repository commands rather than only to prose.

Current commands that carry this work are:

```bash
npm test
npm run bench
npm run bench:stream
npm run bench:check
npm run bench:profile
npm run release:check
```

With the scoped work landed, the repository now makes it easier to tell which of these commands provide:

* current release-gate proof
* exploratory pressure evidence
* guarded performance regression detection

And where practical, those commands expose memory-pressure evidence clearly enough that maintainers can answer:

* which profiles keep pending state small?
* which profiles allow large buffered accumulation?
* which workloads create fragmentation or churn without obvious correctness failure?

For example, the current `150k` and `250k` watermark-lag profiles can now be rerun with `--expose-gc` to compare:

* heap before the run
* heap after the run
* heap after an explicit forced GC

That is useful `0.3.3` evidence even before the repo decides whether any part of it belongs in an enforced benchmark policy.

## Docs And Release Wording

By the end of `0.3.3`, the repository makes one consistent claim about what this release means.

That includes:

* README wording
* guides
* roadmap references
* changelog and release notes
* perf-check expectations

The wording stays disciplined:

* `0.3.2` is the production-credibility gate
* `0.3.3` is the broader streaming hardening and pressure follow-up

Where heavier pressure evidence remains exploratory, the wording reflects that rather than implying a closed hotspot story.

## Not In Scope Yet

`0.3.3` does not try to solve:

* contradictory domain events
* entity fork semantics
* semantic duplicate detection for different event IDs that represent the same action
* a new domain-aware merge or correction policy layer
* a fundamentally different stream finality model

Those belong to later contract and extension-point design work, not to this pressure-expansion milestone.

## Exit Criteria

`0.3.3` is complete because:

* broader streaming pressure coverage exists beyond the minimum `0.3.2` release-gate set
* the most important remaining streaming hotspots have fresh profile-backed evidence
* bounded-memory and backpressure behavior are not only documented, but exercised under stronger pressure conditions
* maintainers have clearer evidence for which streaming stress cases should become future enforced guards
* stream memory pressure is more observable in the pressure tooling, even where it is not yet stable enough to enforce as a hard guard
* docs and release wording keep the distinction clear between production-gate proof and broader pressure-follow-up hardening

That now includes at least one explicit stream-pressure guard beyond the older `100k` streaming plateau case, rather than leaving all broader `0.3.3` stream pressure work in visibility-only status.
