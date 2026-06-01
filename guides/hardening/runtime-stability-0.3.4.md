# Runtime Stability

This guide is the runtime-stability follow-up to the broader pressure work already in place.

The purpose of this line is not to widen semantics again.
It is to make the streaming contract more credible under prolonged and constrained runtime conditions.

At this stage, the important distinction is:

* the earlier pressure work widened visibility and hotspot evidence
* this guide turns the most important of those cases into stronger sustained-runtime proof

## What Has Landed So Far

The current runtime-stability line is centered on four concrete areas:

* repeated-cycle stream endurance runs in one process
* constrained-heap stream endurance runs
* GC-observed stream endurance runs
* sustained correction-churn and anomaly-heavy reconnect endurance profiles

These changes are about longer and more operationally realistic evidence, not about redefining the stream contract.

## Endurance Harness

The project includes an explicit stream endurance runner:

* `perf/endurance.mjs`

This runner supports:

* repeated in-process cycles
* time-boxed duration runs
* warmup control
* pause control between cycles

The purpose is to answer questions like:

* does the stream stay stable across repeated cycles in one process?
* does throughput collapse over time?
* does heap behavior drift in an obvious way across repeated runs?

## Constrained-Heap Runs

The project also includes an explicit constrained-heap wrapper:

* `perf/constrained-heap.mjs`

This makes it straightforward to run the existing endurance profiles under smaller Node heap limits instead of only under default runtime settings.

That matters because a profile that looks clean under a roomy default heap can still become operationally uncomfortable once memory is tighter.

At this stage, these runs are evidence-oriented:

* they show what remains stable
* they show what becomes slower
* they make smaller-heap behavior visible

They do not yet claim that every constrained-memory shape is stable enough for routine enforcement.

## GC-Observed Runs

The project includes an explicit GC-observed stream wrapper:

* `perf/gc-observed.mjs`

This complements the earlier heap sampling by making GC activity directly visible during repeated endurance runs.

The GC-observed work surfaces:

* GC count
* GC duration
* max GC pause
* forced GC hook counts when that mode is used deliberately

The goal here is not to treat every GC event as a failure.
The goal is to make it easier to reason about whether the stream contract stays understandable once collection pressure becomes real.

## Sustained Correction And Reconnect Pressure

The project includes longer-band endurance profiles for two main sustained operational churn cases:

* `streaming-150k-correction-churn`
* `streaming-150k-anomaly-heavy-reconnect`

These are not just short hotspot probes.
They are intended to show that correction-heavy and reconnect-heavy stream shapes remain operationally credible across repeated in-process cycles.

That matters because:

* reconnect storms keep delayed backlogs alive longer
* correction churn keeps forcing repeated non-trivial flush decisions
* anomaly-heavy replay and reconnect paths can be meaningfully slower and noisier than cleaner steady-state stream shapes

The purpose of these profiles is to make that cost visible without changing the semantics the package already established today.

## Current Posture

The posture is:

* endurance and constrained-runtime evidence is now explicitly part of the shipped hardening story
* the `150k` sustained watermark-lag stream profile remains the enforced stream guard
* `250k` stream pressure remains exploratory stretch visibility
* the newer correction-heavy and reconnect-heavy endurance profiles are evidence-oriented rather than routine CI guardrails

That is the honest middle ground:

* stronger than one-off short pressure snapshots
* still more conservative than a future fully-settled `1.0` contract claim

## What This Work Is Not

This work is not:

* a new stream semantic model
* a new correction policy model
* a new memory guarantee
* a new domain-conflict or merge layer

It is runtime-stability work for the streaming contract.

## Remaining Work

The important remaining work after this runtime-stability layer is not basic scaffolding.
It is the later maturity work around API stability, tooling, transferability, and long-term contract confidence.
