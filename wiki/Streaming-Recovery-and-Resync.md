# Streaming Recovery and Resync

Streaming recovery and resync is the point where distributed timelines stop being a neat batch problem and become an operational one.

This is not only about unusual outages.
It also describes ordinary systems where:

* producers reconnect late
* offline devices sync after a delay
* central output must keep moving while delayed history still arrives

## Why It Matters

In a bounded replay, you can wait for the full set and then order it.

In a live stream, you usually cannot.
The system has to emit useful output now while staying honest that:

* more events may still arrive
* some of those events may be operationally late
* previously emitted non-final output may need reconciliation

That is why the streaming model uses:

* watermarks
* lateness windows
* late-arrival policies
* provisional versus final output

## The Conceptual Rule

The key distinction is:

* causal truth is one question
* operational readiness is another

A stream batch can be ready to emit because the watermark advanced enough for an operational decision.
That does not mean the system has proved no older relevant event could still appear.

In the current `0.3.1` contract, this also means:

* correction scope is policy-based across previously emitted non-final output in the same stream instance
* cross-window relational anomaly history is intentionally narrow
* non-final output should be treated as replaceable derived state rather than as irreversible truth

## Typical Deployment Shape

This model is especially relevant when:

* a producer goes silent and reconnects later
* the central server is down for several hours
* nodes continue locally and sync once central availability returns

That is one of the reasons `causal-order` treats streaming as a first-class operational model rather than just an afterthought to bounded replay.

## Where To Go Next

For the full operational guide, stream contract details, downstream write patterns, and reconnect example, see:

* [Streaming Recovery And Resync guide](../guides/streaming-recovery-resync.md)

For the focused conceptual treatment of operational versus causal finality, see:

* [Streaming Finality](Streaming-Finality)
