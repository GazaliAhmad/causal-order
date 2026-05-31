# Clocks, Causality, And Why HLC

Distributed systems need some way to talk about event order.
But different clock models answer different questions, and they do not all provide the same kind of truth.

This guide explains where `causal-order` sits in that landscape:

* why Lamport clocks are useful but incomplete
* why vector clocks are richer but heavier
* why this library uses Hybrid Logical Clocks
* what the HLC clock helper in `causal-order` actually does
* why that helper is not Cristian's algorithm

## The Short Version

`causal-order` does not treat any clock as a complete causality oracle.

Its practical stance is:

* explicit causal metadata is strongest
* same-node monotonic sequence is strong local evidence
* HLC is useful cross-node ordering metadata
* HLC alone is still only `derived`, not `proven`

That is why the library combines HLC with parent links, dependency links, and same-node sequence evidence instead of pretending one clock solves the whole problem.

## Lamport Clocks

Lamport clocks give you a logical ordering discipline:

* if one event causally happened before another and the protocol propagates Lamport timestamps correctly, the earlier event gets the smaller timestamp
* they are cheap and simple
* they capture causal precedence better than naive wall-clock timestamps

But Lamport clocks do not tell you:

* whether two events are concurrent
* how far apart events were in physical time
* whether two close timestamps mean anything about real elapsed time

That matters because many operational systems need more than "some logical order."
They also need a time-aware shape for replay, audit, and windowed stream handling.

## Vector Clocks

Vector clocks carry richer causal information than Lamport clocks.

They can tell you:

* one event happened before another
* two events are concurrent

That is powerful.
But it comes with real cost:

* metadata grows with the participant set
* dynamic membership makes the vectors harder to manage
* serialization, storage, and comparison overhead all rise
* many event pipelines do not naturally preserve vector-clock state end to end

For some systems, that tradeoff is worth it.
For many practical event pipelines, it is too heavy for the default event envelope.

## Why This Library Uses HLC

Hybrid Logical Clocks are a practical middle ground.

They preserve:

* a physical-time component
* a logical counter for monotonic progress when wall time stalls or messages arrive out of order

That gives the library something very useful:

* time-aware ordering that is more operationally honest than raw wall-clock sort
* monotonic same-node clock progression without pretending clocks are perfectly synced
* a reasonable event-time field for batch ordering and stream watermark handling

But HLC still does not prove causality by itself.

If:

```txt
A.hlc < B.hlc
```

that can justify a useful derived ordering.
It does not prove that `B` observed, depended on, or was caused by `A`.

That is exactly why `causal-order` treats HLC-only ordering as `derived`.

## What The HLC Clock Helper Does

`causal-order` exposes `createHlcClock()` with three practical inputs:

* `nodeId`
* optional `now()` source
* optional `maxDriftMs`

That clock then exposes three operations:

* `now()`
* `receive(remote)`
* `getState()`

### `now()`

`now()` advances local HLC state using the local wall-clock source.

In practice:

* if wall time moved forward, `physicalTimeMs` advances and `logicalCounter` resets to `0`
* if wall time did not move forward, the clock keeps the same physical time and increments `logicalCounter`

That preserves monotonic local progress even when wall time stalls or moves too slowly to distinguish nearby events.

### `receive(remote)`

`receive(remote)` merges a remote HLC timestamp into local state.

In practice:

* the remote timestamp is validated
* local wall time is read
* if `maxDriftMs` is configured and the remote physical time is too far in the future, the merge is rejected
* the new physical time becomes the maximum of:
  * local HLC physical time
  * remote HLC physical time
  * local wall time
* the new logical counter is chosen according to the standard HLC merge cases

That gives the node a monotonic merged timestamp without pretending either side had perfect wall-clock truth.

### `getState()`

`getState()` returns a copy of the current HLC state.

That is mostly an operational convenience for inspection, serialization, and testing.

## What The HLC Clock Helper Does Not Do

It is just as important to say what this code does not do.

It does not:

* synchronize clocks across machines
* estimate network delay
* calculate a global canonical time
* prove causality from clock values alone
* provide vector-clock-style concurrency detection

So when the library uses HLC, it is using a disciplined event timestamp format.
It is not claiming distributed time has been solved.

## Why This Is Not Cristian's Algorithm

Cristian's algorithm is a clock-synchronization protocol.

Its purpose is to let a client estimate a better wall-clock time by talking to a time server and accounting for round-trip delay.

That is not what `causal-order`'s HLC clock helper does.

The HLC helper:

* does not contact a time server
* does not estimate one-way or round-trip network delay
* does not compute clock offset from request-response exchange
* does not align nodes to one server-derived wall-clock value

Instead, it assumes each node already has some local wall-clock source and then builds a monotonic hybrid logical timestamp on top of that local source plus remote event timestamps.

So the honest comparison is:

* Cristian's algorithm tries to improve wall-clock synchronization
* the HLC helper in `causal-order` tries to preserve monotonic event timestamps despite imperfect clocks and message timing

Those are related concerns, but they are not the same mechanism.

## Where Explicit Causality Still Matters

This is the key architectural point for `causal-order`.

Even with HLC, explicit causality still matters because the library wants to distinguish:

* "these events look earlier and later"
* from
* "this event actually depends on that one"

That is why parent links, dependency links, and same-node monotonic sequence still matter so much.

In current releases:

* explicit parent and dependency links can produce `proven` causal ordering
* same-node monotonic sequence can produce strong same-node ordering evidence
* HLC order across nodes is useful, but remains `derived`

That separation is intentional.
It keeps the library operationally useful without letting clock metadata impersonate causal proof.

## Why Not Use Vector Clocks Instead

If your system can afford vector-clock metadata and preserve it end to end, vector clocks may let you express concurrency more directly than HLC.

But this library is aimed at a more common operational shape:

* event records already have timestamps or HLC-like fields
* metadata budget matters
* event envelopes cross many system boundaries
* explicit dependency edges are available only in some flows

For that shape, HLC plus explicit causal metadata is often a more deployable compromise than requiring full vector-clock propagation everywhere.

## Practical Takeaway

If you want the shortest honest summary, it is this:

* Lamport clocks are simpler but less time-aware
* vector clocks are richer for causality but heavier operationally
* HLC is a practical middle ground for event ordering
* `causal-order` still needs explicit causal metadata because HLC alone is not proof

That is the model this library is built around.
