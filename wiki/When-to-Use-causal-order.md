# When to Use causal-order

Use `causal-order` when you have distributed events and you do not want to lie to yourself about the timeline.

## Good Fits

The library is a strong fit for:

* audit timeline reconstruction
* replay analysis
* multi-region debugging
* offline sync inspection
* late-arrival stream handling
* distributed incident analysis

It is especially useful when:

* the events come from multiple nodes or regions
* wall-clock timestamps are imperfect
* ordering claims need explanation
* concurrency matters
* weak metadata should not be silently normalized

## Less Useful Fits

It may be unnecessary when:

* everything happens on one trusted process with one reliable sequence
* plain local ordering is already obvious
* the system does not need explainable event order

## The Litmus Test

If your team has ever said:

* “we just sorted by timestamp”
* “this replay looks newer than the original”
* “the device synced later, so the timeline got weird”
* “we need to know whether this order is real or inferred”

then `causal-order` is likely solving a real problem for you.
