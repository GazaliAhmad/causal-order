# Streaming Finality

Streaming systems create a different kind of problem from bounded event batches.

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
