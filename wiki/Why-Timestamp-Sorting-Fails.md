# Why Timestamp Sorting Fails

Sorting by timestamp is attractive because it is simple, fast, and easy to explain.

But in distributed systems, a timestamp is often only one weak signal among several.

## Why It Looks Correct

Timestamp sorting feels reasonable because:

* every event appears to have a time
* humans naturally interpret time as order
* sorted output looks neat and complete

The danger is that neat output can create false confidence.

## Where It Breaks

Timestamp sorting can produce the wrong story when:

* clocks drift between nodes
* events are replayed later
* ingestion order differs from creation order
* a device syncs after being offline
* two events happen concurrently
* explicit causal metadata contradicts wall-clock order

## The Better Question

Instead of asking:

> What is the prettiest total order?

`causal-order` asks:

> What order can actually be justified?

That leads to a less convenient answer sometimes.
But it is a safer answer.

## The Philosophy

If the system only has weak evidence, the output should say so.
If the library can positively justify no supported causal relationship, the output should allow concurrency.
If the metadata is not strong enough, the output should leave room for unknowns.
