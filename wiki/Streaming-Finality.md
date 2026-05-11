# Streaming Finality

Streaming systems create a different kind of problem from bounded event batches.

This is not only about outage recovery.
It also describes normal day-to-day stream processing when events keep arriving and output must keep moving.

In a batch, the question is:

* what can we say about this set of events?

In a stream, the question becomes:

* what can we say now, knowing more events may still arrive later?

## Finality Is Operational

In `causal-order`, stream finality is not treated as causal truth.

It is an operational statement based on:

* watermarks
* lateness windows
* arrival policy
* bounded memory decisions

This is a crucial distinction.

## Why This Matters

A stream may emit a batch as final because:

* the watermark has advanced
* the lateness window has closed
* the system must move forward

That does not mean the universe proved no earlier event could exist.

It means the system has made a bounded operational decision.

## The Rule

`causal-order` tries to keep these ideas separate:

* causal certainty
* operational finality

That separation protects users from accidentally treating a streaming watermark as if it were proof of real-world event order.

## Lateness Is Operational Too

`maxLateArrivalMs` belongs to the same operational layer.

It tells the stream how long to wait before treating output as stable enough to emit.
It does not decide whether an ordering relationship is causally `proven`.

That means an event can still be:

* causally older because it carries explicit parent, dependency, or same-node sequence evidence
* operationally too late for the current stream window

When that happens, the stream should handle the event through the configured late-arrival policy.
It should not silently downgrade causal proof into mere uncertainty.

For the `0.3.0` daily-operations, delayed reconnect, and downstream correction model, see [Streaming Recovery and Resync](Streaming-Recovery-and-Resync).
