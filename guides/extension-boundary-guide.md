# Extension Boundary Guide

This guide explains how to build adjacent tooling and workflow layers around `causal-order` without expecting the payload-agnostic core to absorb those concerns directly.

It is package-facing, not speculative.
It does not introduce a new plug-in runtime.
It explains the current boundary so teams can evaluate extension direction without overreading the core contract.

## The Short Version

Today, the package is strongest when the split stays clear:

* the core package translates, orders, and reports causal uncertainty honestly
* the helper layer summarizes existing package output for operators and reviewers
* higher layers own source-specific glue, workflow orchestration, projections, and domain resolution

That means `causal-order` is meant to be composable.
It is not meant to be the one package that also understands every broker, database, file format, or business-truth merge rule.
The intended posture is: deploy the library as the ordering engine, and let adjacent layers handle the rest of the application-specific stack.

## What The Core Owns Today

The package-facing core already owns three important jobs:

1. raw-record translation through `translateBatch()`
2. bounded or streaming ordering through `orderEvents()` and `orderEventStream()`
3. operator-facing explanation through inspection helpers such as `inspectOrderResult()` and `inspectOrderBatch()`

Those surfaces are useful because they preserve:

* explicit causal evidence
* confidence posture
* anomaly visibility
* deterministic fallback when stronger proof is unavailable

That is the contract to build on.
The package helps you reason about event integrity.
It does not claim ownership of every surrounding system concern.

One explicit non-goal is replacing a consensus system that has already settled the exact order you want to trust.
If Raft, Paxos, or an equivalent layer has already produced the authoritative ordering answer for that stream, this library is no longer solving the main ordering problem there.

## Good Places To Extend Around The Package

### Source Adapters And Ingestion Glue

Keep source-specific shaping outside the core package.

Examples:

* Kafka, Kinesis, Pub/Sub, or queue consumers
* JSONL replay readers
* database export loaders
* HTTP or webhook record normalization

The clean pattern is:

1. read source records in your own adapter layer
2. pass the original records into `translateBatch()`
3. let translation own coercion, omission, and anomaly reporting
4. pass translated envelopes into ordering

This keeps the core package payload-agnostic while still giving your deployment a narrow ingress boundary.

### Workflow Orchestration

The core package orders events.
Your workflow layer owns how that ordering is used operationally.

Examples:

* choosing replay-window size
* deciding when to rerun a bounded recovery batch
* replacing or rebuilding a downstream projection
* storing non-final stream output separately from final durable state
* coordinating incident review or operator escalation

This is where teams usually connect `orderEvents()`, `orderEventStream()`, and the inspection helpers into a deployable workflow.

### Operator Review And Reporting

The helper layer is intentionally narrow, but it is a good base for adjacent operator tooling.

Examples:

* audit-facing summaries
* incident timelines
* anomaly dashboards
* reconciliation review screens
* batch or stream inspection exports

The important rule is that the higher layer should explain package output, not erase it.

Keep these visible:

* raw event identity
* anomaly types and severities
* confidence posture
* whether a statement comes from source evidence or derived explanation

### Domain-Semantic Policy

Some problems are real, but they do not belong inside the payload-agnostic core.

Examples:

* contradiction resolution
* entity-fork branch choice
* semantic dedupe across different identifiers
* business-specific canonical-record selection
* field-level merge rules

Those concerns should live in a higher policy layer that can see domain meaning.

The current public type surface already hints at this direction with draft interfaces such as:

* `CausalContradictionPolicy`
* `ForkResolutionPolicy`
* `SemanticDedupePolicy`
* `PolicyVisibilityRecord`

Read those as boundary direction, not as a finished extension framework.
They show the intended split:

* the core may surface candidates and visibility records
* a higher layer owns action and business resolution

## What The Current Core Does Not Promise

`0.8.x` should not be read as promising:

* official broker, storage, or transport adapters inside the main package
* payload-aware contradiction resolution in the core runtime
* built-in branch selection for entity forks
* silent semantic dedupe that hides source records from operator view
* a final plug-in system with stable extension lifecycle guarantees

Those may become better-defined later, but they are not part of the current core claim surface.

## A Safe Extension Checklist

When evaluating a new adjacent layer, ask:

1. does it preserve anomaly and confidence visibility rather than flattening them away?
2. does it keep source evidence separate from higher-layer interpretation?
3. does it avoid claiming stronger causal truth than the package actually emitted?
4. does it keep deployment-specific glue outside the core runtime boundary?
5. does it leave operators able to audit what happened after higher-layer policy acts?

If the answer to those questions is yes, the layer is probably aligned with the current extension direction.

## Practical Reading Path

Use these docs together:

* [Package Surface Overview](./package-surface-overview.md) for the first map of the exported package surface
* [Policy Guidance](./policy-guidance.md) for strictness and late-arrival choices
* [Supported Vs Unsupported Usage](./supported-vs-unsupported-usage.md) for the current contract boundary
* [Examples And Entrypoints](./examples-and-entrypoints.md) for the practical package-facing entrypoint map around that boundary

If your next question is operational rather than architectural, continue with:

* [Replay Inspection Workflow](./operations/replay-inspection-workflow.md)
* [Streaming Reconciliation Workflow](./operations/streaming-reconciliation-workflow.md)
* [Incident Review Guide](./operations/incident-review-guide.md)

## Bottom Line

`causal-order` is most useful when it stays honest about what it knows.

That honesty is also the extension story.
The package gives you a payload-agnostic causal and anomaly surface.
Your adjacent layers can build adapters, orchestration, and domain policy on top of it without forcing those concerns into the core runtime itself.
