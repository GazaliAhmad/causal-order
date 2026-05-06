# Causal Inversion

Causal inversion is the clearest red flag in a distributed timeline:

```txt
the evidence says A caused B, but the timestamps make B appear earlier than A
```

## Example

Suppose:

* `request_received` is the parent event
* `invoice_created` points to that parent

But the raw timestamps say:

* `invoice_created` at `10:00:00.001`
* `request_received` at `10:00:00.050`

If you sort by timestamp alone, the child appears to happen before the parent.

## What The Library Should Do

This should not be silently normalized.

The library should:

* preserve the causal evidence
* flag the mismatch as a `causal_inversion`
* avoid pretending that clock order has overridden explicit dependency evidence

## Why This Matters

Causal inversion is often a symptom of:

* clock drift
* delayed ingestion
* replay artifacts
* partial tracing data
* broken instrumentation

That makes it operationally useful.

It is not just a comparison result.
It is a debugging signal.

## The Bigger Lesson

When explicit causal evidence and naive timestamp order disagree, the disagreement itself is important.

That disagreement is exactly the kind of thing a good event integrity library should make visible.
