# `0.3.4` Implementation Guide

This note keeps `0.3.4` implementation work scoped and commit-friendly.

It does not prescribe code structure in advance.
It keeps the sequencing clear:

* add endurance visibility first
* add constrained-runtime evidence second
* tighten claims only after the longer runs are understood

For the broader milestone intent, see:

* [ROADMAP `0.3.4`](../../ROADMAP.md)

## Working Rule

`0.3.4` should be implemented in small chunks that separate:

* long-run harness work
* repeated-cycle verification
* constrained-heap runs
* GC-observed pressure runs
* sustained correction and reconnect pressure
* release wording

The repo should avoid mixing those together unless there is a strong reason.

## Sub-Goal

`0.3.4` should turn the `0.3.3` pressure evidence into stronger runtime-stability proof.

That means:

* do not start by changing semantics
* do not start by widening the public API
* do start by proving the current stream contract holds up for longer and under tighter runtime constraints

This milestone is about endurance, not scope expansion.

## Chunk Order

The intended order is:

1. long-run benchmark harness and repeated-cycle commands
2. constrained-heap run support
3. GC-observed pressure runs
4. sustained correction and reconnect endurance cases
5. docs and release wording

The early chunks should answer basic runtime questions first:

* does the process stay stable over longer runs?
* do repeated cycles in one process drift or degrade?
* what happens when heap limits are smaller?
* what happens when GC actually triggers during the run?

Only after that evidence is clear should the repo strengthen the release wording.

At the `0.3.4` stage, the important distinction is:

* `0.3.3` widened pressure visibility and hotspot evidence
* `0.3.4` should turn the most important of those cases into stronger sustained-runtime proof

## Things To Avoid

Avoid combining these in one commit:

* long-run harness work plus stream semantic changes
* constrained-heap runs plus unrelated benchmark reshaping
* GC-observed instrumentation plus new hard guarantees
* endurance pressure cases plus ecosystem package work
* docs wording plus unverified stability claims
