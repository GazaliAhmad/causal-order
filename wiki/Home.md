# causal-order Wiki

`causal-order` is a library for reconstructing distributed event timelines without pretending the system knows more than it does, even when the deployment cannot rely on a globally synchronized clock.

This wiki is the conceptual layer of the project.
It explains the mental model behind the library, why the problem is harder than ordinary timestamp sorting, and how `causal-order` tries to stay honest without becoming unusable.

For the practical, repository-coupled layer with operational walkthroughs, deployment patterns, and implementation-shaped usage guides, see `/guides`.

If the README is the quick path, this wiki is the deeper explanation.

For the repo-coupled usage side, that now includes the `0.4.0` raw-record ingress surface around synchronous `translateBatch()` translation before ordering.
The practical contract and examples for that surface live in `/guides` and the main README rather than in the conceptual wiki pages.

## Start Here

If you are new to the project, read these pages first:

1. [What This Library Is](What-This-Library-Is)
2. [The Problem With Distributed Timelines](The-Problem-With-Distributed-Timelines)
3. [Confidence Levels](Confidence-Levels)
4. [Concurrent vs Unknown](Concurrent-vs-Unknown)
5. [Streaming Finality](Streaming-Finality)
6. [Streaming Recovery and Resync](Streaming-Recovery-and-Resync)

## Conceptual Pages

* [What This Library Is](What-This-Library-Is)
* [The Problem With Distributed Timelines](The-Problem-With-Distributed-Timelines)
* [Why Timestamp Sorting Fails](Why-Timestamp-Sorting-Fails)
* [Confidence Levels](Confidence-Levels)
* [Concurrent vs Unknown](Concurrent-vs-Unknown)
* [Streaming Finality](Streaming-Finality)
* [Streaming Recovery and Resync](Streaming-Recovery-and-Resync)
* [Realistic Workloads](Realistic-Workloads)
* [Operational Fuzzing](Operational-Fuzzing)
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

That includes both:

* the explicit streaming model for day-to-day live processing, delayed reconnect, and resync flows
* the narrow synchronous ingress path for translating raw user-space records into the event envelope without pulling file, CLI, or transport glue into the core package

So the project is not only about explaining distributed timelines after the fact.
It is about giving real systems an event-integrity model designed to work without treating global clock sync as the source of truth.

## Project Standard

`causal-order` should feel easy to use at the surface, but difficult to misuse into false certainty.
