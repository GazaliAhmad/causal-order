# What This Library Is

`causal-order` is an event integrity library for distributed systems that cannot rely on a globally synchronized clock.

It is designed for situations where events come from multiple services, devices, workers, regions, or replicas, and where ordinary wall-clock timestamps are not enough to tell a trustworthy story.
The library's job is to help those systems stay operationally honest without requiring one perfect global time source.

## What It Does

At a high level, the library helps a developer:

* validate event metadata
* order what can be ordered
* preserve concurrency only when it can be justified honestly
* flag anomalies and suspicious records
* preserve the difference between strong evidence and weak inference
* run batch and streaming workflows without pretending global clock sync is the truth model

## What It Is Not

It is not:

* a general date-time library
* a tracing platform
* a database
* a queue
* a generic distributed systems framework

It is also not a promise that every event set can be fully ordered.

That is one of the central ideas of the project:
some timelines should not be flattened into a fake single sequence just because a system wants a neat answer.

## Why It Exists

Many systems still do something like this:

1. collect events from different places
2. sort them by timestamp
3. treat the result as a reliable timeline

That often produces a clean-looking answer.
But in distributed systems, clean-looking answers are often wrong.

`causal-order` exists to make that uncertainty visible instead of hiding it.

In the published `0.4.1` line, that scope includes:

* bounded batch ordering
* the streaming contract for late arrivals, watermarks, correction-capable output, and reconnect-heavy recovery flows
* the narrow synchronous ingress surface for translating raw application records into the event envelope through `translateBatch()` before ordering
* the machine-readable diagnostics and strictness-policy surface for understanding translation failures without scraping free-form text

The published `0.4.2` follow-through completed the package-facing evaluation work around that shipped surface:

* runnable ingress examples that show the real `translateBatch()` to `orderEvents()` path
* example code that uses the public `causal-order` package surface rather than repo-internal imports
* tighter synchronization between docs and what those runnable examples actually do

That ingress work is intentionally kept payload-agnostic and environment-free rather than growing into file parsing, CLI tooling, or transport adapters inside the core package.

The active `0.5.x` line now focuses on a different question:

* which exported names and defaults are stable enough to preserve into `1.0.0`?
* which domain-semantic behaviors belong in the payload-agnostic core?
* which domain-semantic behaviors should live behind extension points or remain out of scope?

That means this library has become more than a nicer sort function.
It is now a deployment-oriented event-integrity layer for event pipelines that need to survive drift, replay, late sync, and partial causal evidence without falling back to fake global-clock certainty.
