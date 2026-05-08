# Mental Model

Most engineers are taught a simple rule:

```txt
timestamp = order
```

That rule works often enough to feel natural.
It also fails often enough to create false confidence in distributed systems.

`causal-order` starts from a stricter rule:

```txt
wall-clock time is metadata, not proof
```

## What The Library Tries To Answer

For any pair or set of events, the library tries to separate four different cases:

* `proven`: explicit causal evidence exists
* `derived`: order can be inferred, but causality is not proven
* `concurrent`: the library can positively justify that no supported causal order exists
* `unknown`: the metadata is insufficient or invalid

That distinction matters because these are not interchangeable.

## What Counts As Strong Evidence

Examples of explicit causal evidence:

* `parentEventId`
* explicit dependency lists
* same-node monotonic sequence

In current releases, this supported evidence set is intentionally narrow.
Shared `traceId`, shared `partition`, HLC order, and ingestion order can still be useful without becoming causal proof.

When that evidence exists, the library can say more than "A happened earlier."
It can say:

```txt
A caused B
```

## What HLC Gives You

Hybrid Logical Clocks are useful, but they are not magic.

If:

```txt
A.hlc < B.hlc
```

then the library can often place `A` before `B` for processing.
That is valuable.
But it still does not prove that `B` observed, depended on, or was caused by `A`.

That is why HLC-only ordering is `derived`, not `proven`.

## What Concurrency Means

`concurrent` does not mean "we gave up."

It means the library can positively justify that, within the currently supported causal model, the answer is:

```txt
neither event is known to causally precede the other
```

That is a real result, not a weak one.
But the current runtime intentionally prefers `unknown` over speculative concurrency, especially across nodes without explicit supported evidence.

## What Unknown Means

`unknown` means the library cannot safely make a claim.

That usually happens because:

* the clock is invalid
* the event metadata is partial
* IDs are malformed or missing
* sequence data is unusable
* the inputs cannot support a reliable comparison

This is the library refusing false certainty.

## The Practical Shift

The purpose of `causal-order` is not to make timelines look more ordered.
It is to make them more honest.

A good outcome is not always:

```txt
here is the exact total order
```

A good outcome is often:

```txt
these events are provably ordered
these are only inferred
these might be concurrent, but remain unknown under the current supported model
these are too broken to trust
```
