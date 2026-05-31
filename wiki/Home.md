# causal-order Wiki

`causal-order` is a library for reconstructing distributed event timelines without pretending the system knows more than it does, even when the deployment cannot rely on a globally synchronized clock.

This wiki is the conceptual layer of the project.
It explains the mental model behind the library, why the problem is harder than ordinary timestamp sorting, and how `causal-order` tries to stay honest without becoming unusable.

If you want the quickest path into the package, start with the [README](https://github.com/GazaliAhmad/causal-order/blob/main/README.md).
Use this wiki when you want the deeper explanation behind what the guides and API reference are doing.
For package-facing usage, examples, and operational walkthroughs, use the [guides](/guides/), the [API reference](/api/), and the [examples folder](https://github.com/GazaliAhmad/causal-order/tree/main/examples).

## How To Use These Docs

Use each doc surface for a different job:

* [README](https://github.com/GazaliAhmad/causal-order/blob/main/README.md) for the shortest path to understanding the library
* [guides](/guides/) for practical usage, workflows, and package-facing documentation
* this wiki for concepts, terminology, and deeper explanation

## Start Here

If you are new to the project, read these pages first:

1. [What This Library Is](What-This-Library-Is)
2. [The Problem With Distributed Timelines](The-Problem-With-Distributed-Timelines)
3. [Confidence Levels](Confidence-Levels)
4. [Concurrent vs Unknown](Concurrent-vs-Unknown)
5. [Streaming Finality](Streaming-Finality)
6. [Streaming Recovery and Resync](Streaming-Recovery-and-Resync)

## Practical Next Steps

If you already understand the concepts and want to use the package:

* start with [Quick Start Scenarios](/guides/quick-start-scenarios/)
* see [Policy Guidance](/guides/policy-guidance/) for operational strictness and late-arrival choices
* see [Replay Inspection Workflow](/guides/operations/replay-inspection-workflow/) for bounded replay inspection
* see [Streaming Reconciliation Workflow](/guides/operations/streaming-reconciliation-workflow/) for stream correction and reconciliation
* see [Operator Metrics Guide](/guides/operations/operator-metrics-guide/) for operator-facing metrics and summaries

## Concept Pages

* [What This Library Is](What-This-Library-Is)
* [The Problem With Distributed Timelines](The-Problem-With-Distributed-Timelines)
* [Why Timestamp Sorting Fails](Why-Timestamp-Sorting-Fails)
* [Confidence Levels](Confidence-Levels)
* [Concurrent vs Unknown](Concurrent-vs-Unknown)
* [Streaming Finality](Streaming-Finality)
* [Streaming Recovery and Resync](Streaming-Recovery-and-Resync)
* [Realistic Workloads](Realistic-Workloads)
* [Stress Hardening](Stress-Hardening)
* [Design Philosophy](Design-Philosophy)
* [When to Use causal-order](When-to-Use-causal-order)

## The Core Idea

The library does not try to make distributed event order magically certain.
It tries to answer a more honest question:

> What can be ordered safely, what is only inferred, what can be justified as concurrent, and what should remain unknown?

That means the value of the library is not just:

* sorting events

It is also:

* showing when order is justified
* showing when order is only derived
* refusing to flatten concurrency into fake sequence
* making suspicious or weak metadata visible

So the project is not only about explaining distributed timelines after the fact.
It is about giving real systems an event-integrity model designed to work without treating global clock sync as the source of truth.

## Project Standard

`causal-order` should feel easy to use at the surface, but difficult to misuse into false certainty.
