# What This Library Is

`causal-order` is an event integrity library for distributed systems.

It is designed for situations where events come from multiple services, devices, workers, regions, or replicas, and where ordinary wall-clock timestamps are not enough to tell a trustworthy story.

## What It Does

At a high level, the library helps a developer:

* validate event metadata
* order what can be ordered
* preserve concurrency only when it can be justified honestly
* flag anomalies and suspicious records
* preserve the difference between strong evidence and weak inference

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

In the current `0.3.0` release line, that scope includes both bounded batch ordering and the baseline streaming contract for late arrivals, watermarks, and reconnect-heavy recovery flows.
