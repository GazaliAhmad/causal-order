# Replay Corruption

Replay corruption happens when old events are re-emitted or re-ingested and end up looking newer than the events they originally preceded.

## Why Timestamp Sorting Fails

Imagine an order pipeline:

1. `order.created`
2. `payment.captured`
3. `shipment.created`

Later, a replay job reprocesses historical records and emits `order.created` again with a fresh ingestion time.

Naive sorting by ingestion timestamp can produce:

1. `payment.captured`
2. `shipment.created`
3. replayed `order.created`

That output is tidy, but wrong.

## What The Library Should Surface

`causal-order` should help a developer see that:

* replayed events may have newer ingestion metadata than the original causal chain
* explicit dependencies still matter more than wall-clock appearance
* duplicate IDs or suspicious replays should be visible as anomalies

## What A Safer Result Looks Like

Instead of trusting the replayed timestamp, a safer result may say:

* the replayed event is a `duplicate_event`
* ingestion order is only `derived`
* the causal chain from original metadata still takes precedence where evidence exists

## Why This Matters

If a replay pipeline can silently rewrite timeline meaning, then debugging, audit reconstruction, and backfills all become harder to trust.

The point of the library is not to forbid replays.
It is to stop replays from quietly pretending to be new causal truth.
