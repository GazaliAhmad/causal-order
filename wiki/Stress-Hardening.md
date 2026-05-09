# Stress Hardening

`causal-order` should not only look correct on small examples.
It should stay honest when the input is large, corrupted, and operationally messy.

That is the purpose of the `0.2.2` stress-hardening work.

## Why This Matters

Small scenario fixtures answer questions like:

* does replay corruption remain visible?
* does weak cross-node evidence stay `unknown`?
* does same-node sequence outrank misleading ingestion order?

Those are necessary semantic checks.
But they do not tell us what happens when the same failure shape is repeated across a large batch.

Stress hardening exists to answer:

* does the semantic model still hold under `150k` corrupted events?
* do anomaly-heavy workloads expose hidden performance cliffs?
* does the implementation remain usable when corruption is dense rather than rare?

## Current Workload Posture

The project now uses two practical workload bands:

* `100k` is the routine credible batch band
* `150k` is the corrupted-dataset stress band for hardening and visibility

This is deliberate.

The point is not to chase the largest abstract number.
The point is to pressure-test the kinds of ugly slices a real team might actually need to inspect together.

## Current Stress Matrix

The current `150k` stress profiles cover:

* duplicate explosion density
* inversion chain density
* malformed-event ratios
* sparse-causality graphs
* massive same-timestamp clusters
* replay storms
* cyclic dependency attempts
* sequence conflicts

These are concentrated versions of the same failure shapes already described in the scenario and case-study materials.

## What This Work Proved

The stress work was worthwhile for two reasons:

* it confirmed that the package semantics still hold under corrupted large-batch pressure
* it exposed a real implementation bottleneck in the ordering queue path that small fixtures did not make obvious

That means the stress suite improved more than benchmark numbers.
It improved the credibility of the package story.

The project can now say not only:

```txt
our examples look right
```

but also:

```txt
our semantics still hold when the data gets ugly at scale
```

## What This Is Not

This is not a claim that every caller should sort giant in-memory batches by default.

For truly large or unbounded workloads, the more honest model is often:

* streaming
* batching
* partitioning

That is why `orderEventStream()` remains important.

## The Main Lesson

The key lesson from this work is simple:

* targeted corrupted-dataset pressure is valuable
* open-ended number chasing is not

The stress suite matters because it is tied to specific operational corruption shapes, not because it uses a bigger number for its own sake.
