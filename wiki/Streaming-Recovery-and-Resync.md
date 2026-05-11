# Streaming Recovery and Resync

`0.3.0` is where `causal-order` starts being honest about continuous streaming generally, not just bounded replay.

That includes both:

* ordinary daily stream processing where events keep arriving as part of normal operations
* delayed reconnect, offline sync, and recovery flows where late arrivals are part of the operational reality

This page focuses on the reconnect and resync slice of that broader streaming story, where:

* a local queue or offline device keeps producing events
* the central system continues moving
* reconnect happens later
* the delayed batch must be merged back into a live stream without pretending nothing changed

## The Recovery Shape

Typical flow:

1. the central system emits and stores normal stream output
2. one producer goes silent or disconnected
3. other producers keep moving the watermark forward
4. the silent producer reconnects and uploads its queued events
5. those events may now be operationally late even when their own local sequence is still truthful

That is one important reason `0.3.0` has watermark, lateness, and correction behavior at all.

The same machinery also matters in normal daily operations when a live stream is simply too large or too continuous to model honestly as one bounded batch.

## Recommended `0.3.0` Baseline

For delayed reconnect and resync flows, the most honest first baseline is usually:

```ts
import {
  ingestedAtWatermark,
  orderEventStream,
} from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 500,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "emit_correction",
  watermark: ingestedAtWatermark,
  strict: false,
})) {
  await applyBatch(batch)
}
```

Why this shape:

* `ingestedAtWatermark` lets central observation time drive stream progress during reconnect
* `emit_correction` keeps late arrivals visible instead of silently dropping them
* `strict: false` allows malformed reconnect payloads to surface as anomalies instead of taking down the whole stream immediately

For ordinary daily operations without reconnect-heavy behavior, the same `orderEventStream()` surface still applies.
The main difference is usually the chosen watermark strategy and late-arrival policy, not whether streaming is conceptually the right model.

## What `emit_correction` Means

In the `0.3.0` baseline contract, `lateArrivalPolicy: "emit_correction"` means:

* late events are still emitted
* a correction-capable batch can be flushed immediately when that late event arrives
* reconnect correction output may arrive as several batches rather than one giant replay bundle
* `isFinal: false` means downstream output must still tolerate change
* only the terminal batch is marked `isFinal: true`

What it does not mean:

* the library does not rewrite your database for you
* the library does not define a universal correction storage schema
* the library does not claim that an emitted batch was causally complete just because it was operationally ready

So the correction contract in `0.3.0` is:

* the library tells you output was ready enough to emit now
* the library tells you when a late arrival means previously emitted state may need reconciliation
* your downstream storage pattern decides how that reconciliation is applied

## Safe Downstream Patterns

The safest first `0.3.0` patterns are:

* store ordered stream output as derived state, not as irreplaceable truth
* keep raw events separately
* keep anomalies separately
* let reconnect correction batches update or rebuild the derived projection

A practical table split is:

* `raw_events`
* `ordered_stream_events`
* `stream_anomalies`
* optional `stream_batches`

## Append-Only Versus Mutable Projections

If your downstream store is mutable:

* treat non-final batches as provisional derived state
* update or replace affected rows when correction-capable batches arrive

If your downstream store is append-only:

* persist the emitted batch
* persist the late-arrival anomaly and correction-capable follow-up batch
* run a separate reconciliation reader that understands newer derived output may supersede older output

The important `0.3.0` rule is not "never emit early."
It is "never hide that the output may still change."

## Delayed Reconnect Example

The repository includes a matching runnable example and scenario coverage for delayed reconnect behavior.

The important `0.3.0` baseline is:

* server-side events can be emitted first
* device-local history can arrive later from a reconnecting queue
* late-arrival anomalies should stay visible
* reconnect events should stay visible instead of being silently dropped

The richer cross-window semantic tightening around how far stream-local proof should carry is still part of the planned `0.3.1` follow-up, not the `0.3.0` baseline.

## Relationship to Batch Replay

This does not replace the simpler bounded replay story, and it also does not mean streaming is only for incidents.

Use bounded batch replay when:

* the backlog is naturally finite
* you can wait for the full replay window
* you want one bounded ordering pass before writing derived results

Use this streaming recovery model when:

* central output must keep moving while reconnects happen
* watermark progress matters
* operational lateness and correction behavior are part of the real problem

Use the same streaming model for ordinary daily operations when:

* events arrive continuously during normal business activity
* you need rolling emitted output instead of one end-of-day ordering pass
* late arrivals and provisional finality are normal operational concerns, not exceptional ones
