# Supported Vs Unsupported Usage

This guide explains what `causal-order` is meant to support today, what it intentionally does not support, and how to tell the difference before you build too much around the wrong expectation.

The short version is:

* supported is narrow on purpose
* unsupported is acceptable when it is explicit
* ambiguous support is what to avoid

## Supported Usage Today

`causal-order` is a good fit when you need to reconstruct or inspect distributed event order without pretending timestamp order is enough on its own.
It is meant to be usable as a deployable event-ordering library inside a real system, while still leaving ingestion, orchestration, and domain-resolution layers outside the core package.
The intended reading is not "interesting research code"; it is "usable ordering infrastructure when your system needs honest causal ordering rather than a plain timestamp sort."
That includes ordinary deployment, not only replay forensics or retrospective analysis.

Supported usage includes:

* deploying the library as the event-ordering layer inside a real distributed workflow
* bounded replay, audit, and recovery batches through `orderEvents()`
* streaming workflows through `orderEventStream()` when late arrivals, correction windows, and reconciliation are part of the real operating model
* raw-record ingress through `translateBatch()` when your source data is not already in the event-envelope shape
* operator-facing inspection through helpers such as `inspectOrderResult()`, `inspectOrderBatch()`, and anomaly summarizers
* payload-agnostic event ordering where the library explains confidence, ordering basis, and anomalies instead of hiding them

This package is especially useful when:

* events come from multiple nodes, services, regions, or devices
* replayed data can arrive out of apparent timestamp order
* you need to show why an order was chosen, not just emit one
* you want uncertainty to remain visible instead of being flattened away

It is much less compelling when your system has already normalized events into the exact ordering truth you trust.
For example, if a consensus layer such as Raft or Paxos has already settled the order cleanly for the stream you care about, the main job of this library has mostly already been done upstream.

## Supported Evidence Model

The supported causal model is intentionally narrow.

Today, the package treats these as the main causality-bearing signals:

* `parentEventId`
* `dependencyEventIds`
* same-node monotonic `sequence`

That means:

* explicit causal edges can produce `proven` ordering
* useful weaker metadata can still produce `derived` ordering
* deterministic fallback can still be applied when stronger support is unavailable
* cross-node events without supported causal evidence should usually remain `unknown`

The package does not treat weak correlation as causal proof just because it is convenient.

## Supported Workflow Shapes

The strongest supported workflow shapes today are:

* bounded batch replay
* audit-style reconstruction
* delayed reconnect and offline-sync review
* live stream ordering with explicit lateness and reconciliation posture

If your workflow can accept:

* confidence-aware output
* anomaly visibility
* explicit late-arrival handling
* a payload-agnostic core

then you are inside the current supported path.

The repo also carries deployment-facing evidence for that claim:

* named `250k` batch and stream validation runs in [Stress Hardening](./stress-hardening.md)
* a documented `1,000,000`-event streaming outage analog in [AWS-Inspired DynamoDB Outage Exercise](./aws-inspired-dynamodb-outage.md)

## Intentionally Unsupported Or Out Of Scope

The package is intentionally not trying to do everything inside the core runtime.

Examples of intentionally unsupported or out-of-scope usage include:

* treating wall-clock timestamp order alone as causal proof
* treating shared `traceId` or `partition` metadata as automatic causal evidence
* pretending the package adds value after a consensus layer has already produced the authoritative order you want to keep
* domain-specific contradiction resolution inside the payload-agnostic core
* field-level domain merge logic for forks, duplicates, or semantic collisions
* broker-, database-, transport-, or file-format-specific glue inside the core package
* silent confidence upgrades from weak evidence just to make output look cleaner

This boundary is deliberate.
The goal is to keep the core library honest and composable rather than letting it absorb every adjacent systems concern.
So the package should be read as a deployable ordering engine, not as a complete event platform.

## If You Need More Than The Supported Path

You may still be able to use `causal-order`, but you should add your own higher-layer policy or glue instead of assuming the core package already claims that behavior.

Examples:

* if you need JSONL, broker, or database ingestion glue, build that around `translateBatch()` rather than expecting the core package to own it
* if you need domain-semantic contradiction or dedupe policy, keep that in your own resolution layer rather than treating it as built into the current runtime
* if you need stronger rejection posture, tighten translation and ordering policies explicitly instead of assuming the defaults already mean "hard fail"

For the package-facing boundary map behind those choices, see [Extension Boundary Guide](./extension-boundary-guide.md).

## Warning Signs That You Are Leaving The Supported Boundary

Pause and re-check the docs if you find yourself expecting the package to:

* prove causality from timestamps alone
* resolve business-domain contradictions automatically
* silently clean suspicious records into a neat timeline
* absorb all environment-specific ingestion logic into the core runtime
* preserve multiple old names or aliases as equally canonical forever

Those expectations usually mean you are relying on a behavior the package does not currently promise.

## Practical Rule

Use this rule when you are unsure:

> if the package docs do not clearly present a workflow or guarantee as supported, do not assume it is quietly part of the contract.

That is not a weakness.
It is how the project avoids turning uncertainty or scope gaps into false certainty.
