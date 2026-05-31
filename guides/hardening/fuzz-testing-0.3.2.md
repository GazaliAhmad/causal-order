# Fuzz Testing

This guide explains the seeded fuzz layer used alongside the production-oriented scenario suite.
It shows how `causal-order` pressure-tests the current contract under randomized outage and recovery noise without giving up reproducibility.

## Why Fuzzing Belongs Here

The existing scenario tests already cover named batch and streaming cases directly.

Fuzzing adds something different:

* randomized delays that look more like real outage backlog
* randomized drops that look more like local fire-and-forget loss
* randomized duplicates that look more like manual plus automatic replay
* randomized reconnect timing that looks more like operational resync
* randomized clock corruption and drift that looks more like wrong-time field machines

That matters because `causal-order` is not only trying to survive ideal fixtures.
It is trying to stay honest when messy operational input still reaches the current batch and streaming APIs.

## What This Fuzz Layer Covers

The current fuzz layer is intentionally split into two practical surfaces:

* batch outage and replay fuzz
* streaming reconnect fuzz

The current files are:

* `test/fuzz/operational-outage-fuzz.test.mjs`
* `test/fuzz/streaming-reconnect-fuzz.test.mjs`

These are release-gate fuzz tests, not open-ended exploratory stress campaigns.

## Batch Outage And Replay Fuzz

The batch fuzz suite covers the current contract under seeded noise for:

* randomized outage-style delays
* randomized drops
* randomized clock drift
* randomized invalid clock corruption
* randomized exact-duplicate replay uploads

It does not try to prove that every shuffled noisy input must produce the exact same total order across every possible weak-evidence cross-node relationship.

Instead, it checks the things the current contract can honestly defend:

* the same seed must reproduce the same ordered output
* the same seed must reproduce the same anomaly output
* shuffled arrival must not change the same-node sequence conclusions that remain justified
* exact duplicate visibility must remain stable
* invalid clock visibility must remain stable
* valid versus invalid event counts must remain stable
* supported same-node and explicit causal edges must not be violated

## Streaming Reconnect Fuzz

The streaming fuzz suite covers reconnect-heavy operational backlogs under seeded noise for:

* delayed reconnect replay
* watermark advancement through delayed ingestion
* `lateArrivalPolicy: "emit_correction"`
* `lateArrivalPolicy: "flag"`
* reproducible correction-trigger visibility

This suite is intentionally arrival-aware.

For batch ordering, shuffled arrival often should not change the causally justified answer.
For streaming reconnect behavior, arrival order is part of the operational contract.

So the streaming fuzz suite checks different invariants:

* repeated runs of the same seeded stream must produce the same batches
* watermark progression must stay monotonic
* same-node emitted sequence order must not regress
* reconnect-delayed events must remain visible as `late_arrival`
* `emit_correction` runs must produce reproducible correction-trigger batches
* `flag` runs must keep the delayed events visible without inventing correction metadata

## Why The Suite Is Seeded

`0.3.2` is using seeded fuzzing because the production gate needs replayable failures.

A useful fuzz failure is not only:

* something weird happened

It is:

* this exact seed reproduced a contract problem
* we can rerun that same seed locally and in CI
* we can tighten either the runtime or the docs from a concrete case

That is why the fuzz layer is bounded and deterministic rather than purely random every run.

## What This Fuzzing Does Not Claim

This fuzz layer does not yet claim to solve:

* contradictory domain-event semantics
* semantic duplicate detection for different event IDs that represent the same action
* entity fork semantics
* long-running hotspot-discovery pressure campaigns

Those are separate questions.

The fuzz layer is only trying to defend the current payload-agnostic batch and streaming contract under realistic operational noise.

## How To Run It

The fuzz tests run as part of:

```bash
npm test
```

They are also part of:

```bash
npm run release:check
```

So the current release gate already treats them as part of normal correctness verification rather than as an optional local experiment.

## Relationship To Broader Pressure Work

The fuzzing here is the bounded, reproducible correctness layer.

Broader pressure work can extend this into exploratory campaigns:

* longer-running seeded runs
* higher-cardinality workloads
* stronger concurrency storms
* sustained correction-window churn
* watermark-lag and memory-growth discovery
* hotspot-finding pressure runs

That follow-up should build on this fuzz harness rather than replacing it.

## Bottom Line

This fuzz suite exists to answer a narrow but important question:

> Does the current contract stay reproducible and operationally honest when real outage, replay, drift, and reconnect noise stop looking clean?

At this stage, the answer is now defended by direct seeded coverage in both batch and streaming form.
