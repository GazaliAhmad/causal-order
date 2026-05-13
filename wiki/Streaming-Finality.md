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

In the current `0.3.1` contract, `lateArrivalPolicy: "emit_correction"` also means
correction scope is policy-based across the active non-final stream history, not a
separate bounded lookback window. A `batch.correction` notice means previously
emitted non-final output from that stream instance may need reconciliation.

The current `0.3.1` contract also keeps cross-window anomaly history narrow:
`batch.anomalyHorizon.retainedEventHistory` is `buffered_window_only`, so
previously emitted events are not retained for later duplicate, sequence, or
causal relational anomaly comparisons. The only relational stream-wide anomaly
that still survives earlier flushes is `late_arrival`, exposed as
`batch.anomalyHorizon.crossWindowRelationalDetection: "late_arrival_only"`.

For downstream writers, the safe rule is simple:
non-final output belongs in replaceable derived state.
If your sink is append-only, non-transactional, or otherwise cannot rewrite
cleanly, treat `batch.correction` and `isFinal` as instructions for a later
reconciliation step rather than as proof that one emitted write is final truth.

For the `0.3.0` daily-operations, delayed reconnect, and downstream correction model, see [Streaming Recovery and Resync](Streaming-Recovery-and-Resync).
