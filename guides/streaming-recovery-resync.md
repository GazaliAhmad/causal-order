# Streaming Recovery And Resync

`causal-order` supports continuous streaming as well as bounded replay.
That matters for both:

* ordinary daily stream processing where events keep arriving as part of normal operations
* delayed reconnect, offline sync, and recovery flows where late arrivals are part of the operational reality

This guide focuses on the reconnect and resync slice of that broader streaming story, where:

* a local queue or offline device keeps producing events
* the central system continues moving
* reconnect happens later
* the delayed batch must be merged back into a live stream without pretending nothing changed

This is also a realistic deployment shape when the central server can be down for hours while individual nodes continue operating locally.

In a real deployment, that outage window may easily be:

* `4` hours for lighter nodes or quieter periods
* `8` hours for busier nodes or nodes accumulating more local events before reconnect

## The Recovery Shape

Typical flow:

1. the central system emits and stores normal stream output
2. one producer goes silent or disconnected
3. other producers keep moving the watermark forward
4. the silent producer reconnects and uploads its queued events
5. those events may now be operationally late even when their own local sequence is still truthful

The same shape applies if the central server itself is unavailable for several hours:

1. individual nodes keep producing events locally
2. each node preserves its own HLC and same-node sequence truth
3. the central server comes back later
4. nodes sync their backlog
5. the merged stream must reconcile delayed history honestly instead of flattening it into fake global-clock order

That is one important reason the streaming surface includes watermark, lateness, and correction behavior at all.

The same machinery also matters in normal daily operations when a live stream is simply too large or too continuous to model honestly as one bounded batch.

## Recommended Baseline

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

In the current contract, `lateArrivalPolicy: "emit_correction"` means:

* late events are still emitted
* a correction-capable batch can be flushed immediately when that late event arrives
* reconnect correction output may arrive as several batches rather than one giant replay bundle
* `isFinal: false` means downstream output must still tolerate change
* only the terminal batch is marked `isFinal: true`
* the emitted `batch.watermark` is the active operational boundary after subtracting `maxLateArrivalMs` from the largest observed watermark signal
* events with `eventTime <= batch.watermark` are ready to flush
* events with `eventTime < batch.watermark` are late

What it does not mean:

* the library does not rewrite your database for you
* the library does not define a universal correction storage schema
* the library does not claim that an emitted batch was causally complete just because it was operationally ready

So the correction contract is:

* the library tells you output was ready enough to emit now
* the library tells you when a late arrival means previously emitted state may need reconciliation
* your downstream storage pattern decides how that reconciliation is applied

## Correction Scope

Correction reach is explicit:

* `lateArrivalPolicy: "emit_correction"` is policy-based rather than bounded by a separate watermark lookback window
* when a batch includes `batch.correction`, any previously emitted non-final output from the same stream instance may need reconciliation
* the library does not yet guarantee that only a smaller watermark slice is affected
* once the terminal batch is emitted with `isFinal: true`, that stream instance is outside the supported correction horizon

So the practical rule is:

* treat every non-final emitted batch as replaceable derived state
* use `batch.correction` as the machine-readable notice that reconciliation is now required
* do not treat `emit_correction` as a bounded historical patch API

## Cross-Window Anomaly Contract

The stream contract also makes retained anomaly history explicit:

* `batch.anomalyHorizon.retainedEventHistory` is `buffered_window_only`
* once a batch has been emitted, those earlier emitted events are not retained for later relational anomaly comparison
* that means `duplicate_event`, `sequence_regression`, `same_node_sequence_conflict`, `causal_inversion`, and `unknown_order` are only guaranteed within the buffered window that is flushed together
* `batch.anomalyHorizon.crossWindowRelationalDetection` is `late_arrival_only`
* `late_arrival` remains stream-wide because it is checked against the active watermark rather than against retained emitted-event history

So in practical terms:

* use stream anomalies for in-window relational visibility
* use late-arrival anomalies for stream-wide operational lateness visibility
* do not assume the stream is preserving a full emitted-history index for later cross-window duplicate or sequence checks

## `batchSize` Semantics

The current contract also makes `batchSize` behavior explicit:

* `batchSize` is a signal to attempt a safe flush, not a hard memory ceiling and not a forced flush of unready events
* if `batchSize` is reached while watermark progress still leaves every buffered event unready, the stream may emit nothing yet
* if `batchSize` is reached and only some buffered events are ready, the stream emits that ready subset and keeps the rest buffered
* if a delayed reconnect event is late under `lateArrivalPolicy: "emit_correction"`, the correction-capable flush can exceed the nominal `batchSize`

So the practical rule is:

* do not size `batchSize` as if it were a strict maximum output batch length
* do not assume `batchSize` alone will bound memory under watermark lag
* do expect small `batchSize` values to fragment reconnect correction flow into several batches when multiple late events arrive one after another

## Safe Downstream Patterns

The safest first patterns are:

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

If your downstream store is non-transactional or only partially transactional:

* do not write non-final stream output straight into an irreplaceable user-facing record as if it were settled truth
* persist raw events, anomalies, and emitted batches separately from the projection that users read
* treat `batch.correction` and `isFinal` as control signals for a reconciliation step, not as proof that one direct write is enough
* let a projector, materialized-view refresh, or reconciliation worker decide when newer provisional output supersedes older output

The important rule is not “never emit early.”
It is “never hide that the output may still change.”

## Delayed Reconnect Example

A matching runnable example is available:

* [Streaming Recovery Resync example](../examples/streaming-recovery-resync.mjs)

That example shows:

* server-side events emitted first
* device-local history arriving later from a reconnecting queue
* late-arrival anomalies staying visible
* reconnect events staying visible with sequence-based ordering instead of being silently dropped

That same operational story scales to a real outage window where the server may be down for `4` to `8` hours while nodes continue locally and sync when connectivity returns.

## Relationship To Batch Replay

This does not replace the simpler bounded replay story, and it also does not mean streaming is only for incidents.

Use [After-Hours Batch Processing](./after-hours-batch-processing.md) when:

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
* nodes may need to continue independently while the central server is down for several hours
* cross-window relational anomaly detection is intentionally narrow in the current contract unless the relevant events are still buffered together
