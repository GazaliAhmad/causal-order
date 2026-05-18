# Operational Fuzzing

`causal-order` now uses seeded operational fuzzing as part of the `0.3.2` production-gate story.

This is not fuzzing for novelty.
It is fuzzing to pressure-test the current contract under realistic outage, replay, reconnect, and clock-noise conditions while keeping failures reproducible.

## Why This Matters

Distributed event systems rarely fail in one clean, named way.

Real incidents often involve combinations of:

* delayed backlog replay
* dropped local records
* duplicate uploads
* reconnect storms
* wrong machine time
* mixed live and delayed arrivals

Named fixtures are still important, but seeded fuzzing helps the repo check whether the current model stays honest when those conditions mix together.

## What `0.3.2` Uses It For

The current fuzz layer is focused and release-gated:

* batch outage and replay fuzz
* streaming reconnect fuzz
* reproducible failures by seed

It is there to defend the current batch and streaming semantics, not to invent new domain-aware behavior.

## What It Expanded Into

The original `0.3.2` fuzz layer was not the broader `0.3.3` exploratory pressure campaign.

That later work widened into:

* longer-running runs
* heavier concurrency and backlog pressure
* hotspot and memory-growth discovery
* stronger sustained stress evidence

The current `0.3.4` line builds on that by focusing on runtime-stability evidence for repeated cycles, constrained heaps, GC-observed runs, and sustained correction/reconnect endurance.

## Practical Layer

For the repository-coupled operational details, see:

* [`guides/hardening/fuzz-testing-0.3.2.md`](https://github.com/GazaliAhmad/causal-order/blob/main/guides/hardening/fuzz-testing-0.3.2.md)

That guide explains the current seeded fuzz scope, the current invariants, and how the `0.3.2` production gate uses the fuzz suite today.
