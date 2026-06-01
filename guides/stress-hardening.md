# Stress Hardening

This guide explains why large-batch stress work matters, what workload bands `causal-order`
currently aims to handle honestly, and how to run the stress tooling yourself.

## Why This Exists

Small scenario fixtures answer semantic questions such as:

* does replay corruption stay visible?
* does weak cross-node evidence remain `unknown`?
* does same-node sequence outrank misleading ingestion order?

Those tests are necessary, but they are not enough.

They do not answer:

* does the library still behave honestly when corruption is repeated thousands of times?
* does anomaly-heavy input expose hidden performance cliffs?
* does the package stay usable when a batch is large and messy at the same time?

That is the point of the stress suite.

## Current Workload Posture

The package treats large-batch guidance in two bands:

* `100k` is the routine credible batch band
* `150k` is the corrupted-dataset stress band for hardening and visibility
* named `250k` batch and stream profiles are already in place as heavier operational validation runs beyond the default routine guard path

This distinction is intentional.

The goal is not to chase the biggest possible number.
The goal is to pressure-test the kinds of ugly batches that real users might actually need to inspect together.

One concrete real-world deployment example is a central server outage where:

* the server is down for `4` to `8` hours
* individual nodes continue producing events locally the whole time
* reconnect or scheduled sync later pushes a large backlog into central reconciliation

In that sense, the `150k` stress band is not only a lab exercise.
It is a plausible deployment envelope for systems with many nodes or with busy nodes accumulating several hours of local history before sync.

## Stress Matrix

Current `150k` corrupted-dataset stress profiles cover:

* duplicate explosion density
* inversion chain density
* malformed-event ratios
* sparse-causality graphs
* massive same-timestamp clusters
* replay storms
* cyclic dependency attempts
* sequence conflicts

These are not random synthetic cases.
They are concentrated versions of the same failure shapes already represented in the scenario guides and fixtures.

## What The Stress Work Proved

The stress pass is valuable for two reasons:

* it confirmed that the semantic model still holds under large corrupted batches, not just under hand-sized examples
* it exposed a real bottleneck in the ready-queue ordering path that small tests did not make obvious

The important lesson is not only that the code got faster.
It is that the stress suite made the package story more credible.

`causal-order` is not only saying:

```txt
our examples look right
```

It is also saying:

```txt
our semantics still hold when the data gets ugly at scale
```

## What This Work Is Not

This guide is not arguing that every caller should sort giant batches by default.

The stress suite is a hardening tool, not a claim that one huge in-memory batch is the right model for every workload.

For truly unbounded or operationally huge event flows:

* batch and partition when possible
* prefer `orderEventStream()` when the workload is naturally streaming
* treat million-scale processing as a separate scalability question, not the default package promise

## Running The Stress Profiles

Useful commands:

```bash
npm run bench:all
npm run bench:csv
node perf/run.mjs --profile baseline-250k-shuffled
node perf/run.mjs --profile streaming-250k-watermark-lag
node perf/run.mjs --profile stress-150k-inversion-chains
node perf/run.mjs --profile stress-150k-replay-storms
node perf/run.mjs --profile stress-150k-sequence-conflicts
```

For CPU profiling of the slowest stress cases:

```bash
npm run bench:profile
node perf/profile.mjs --profile stress-150k-inversion-chains --top 8
```

The profiling workflow writes `.cpuprofile` output under `perf/results/cpu-profiles`.

## Reading The Results

The benchmark output is meant to answer more than "how long did it take?"

Look at:

* `validEvents` versus `invalidEvents`
* total anomaly count and anomaly breakdown
* confidence counts
* order-basis counts

Those fields help distinguish:

* semantic survival under corruption
* anomaly visibility under corruption
* performance comfort under corruption

That distinction matters because a stress run can be semantically correct while still revealing a bottleneck worth fixing.

## Relationship To The Other Guides

Use the guides this way:

* [Mental Model](./mental-model.md) explains the package philosophy
* [Case Studies](./case-studies.md) explains small, human-readable failure modes
* this guide explains how those same failure modes are pressure-tested at `150k` stress scale, with `250k` batch and stream validation runs also available when you want a heavier operational check

That is the intended progression:

1. understand the semantics
2. understand the failure modes
3. understand how those semantics hold up under stress
