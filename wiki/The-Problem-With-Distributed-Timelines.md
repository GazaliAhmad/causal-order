# The Problem With Distributed Timelines

Distributed systems produce events that look like they belong on one timeline.
But the system usually does not observe those events from one perfect point of view.

Instead, it observes them through:

* different machines
* different clocks
* different network delays
* different ingestion paths
* retries, replays, and duplicated delivery

That means the timeline a developer wants and the timeline the system can honestly justify are not always the same thing.

## Why This Is Hard

A single-machine log often gives the illusion that order is obvious.
In distributed systems, that illusion breaks down quickly.

Examples:

* a replayed old event can arrive looking newer than the original
* a device can create events offline and sync them later
* two regions can disagree on which clock time happened first
* a worker can observe a consequence before another service records the cause
* two events can be truly concurrent, not merely hard to sort

Those delays are not always tiny.
In a real deployment, the central server can be down for `4` to `8` hours while individual nodes continue locally and only sync once central availability returns.

## Why This Is Not Just Bad Tooling

This is not only an implementation nuisance.
It is also the practical consequence of distributed-systems impossibility limits.

There is no free global observer that can always give every node one perfect, unquestionable timeline.
Different parts of the system see different events at different times, through different clocks and different network paths.

That is why libraries in this space end up discussing Lamport clocks, vector clocks, Hybrid Logical Clocks, and related limits on what ordering can honestly mean.

## The Real Design Question

The problem is not whether these edge cases are real.
They are.

The real question is:

> Can a library stay understandable while remaining honest about these limits?

That is the design pressure behind `causal-order`.

It tries to give developers a usable answer without lying about the strength of the evidence behind that answer.
