# Realistic Workloads

There is no end to abstract number-chasing in distributed systems.
If a project says it handles `1M` events, someone will ask why not `10M`.

`causal-order` does not frame scale that way.

## The Better Question

The real question is not:

* how many events exist in the whole system?

It is:

* how many events need to be interpreted together to answer one operational question honestly?

## Typical Work Units

In practice, that often means:

* one account history
* one device sync history
* one incident timeline
* one replay batch
* one tenant slice
* one bounded stream window

## Practical Design Targets

For this project, a useful mental model is:

* `10k` should feel easy
* `100k` should feel solid
* `1M+` should be treated as an explicit scalability target, not a default assumption

This is not about lowering ambition.
It is about staying anchored to the workloads teams actually inspect together.

## Why Streaming Exists

If the natural workload is unbounded or too large to handle honestly as one in-memory batch, the better answer is often streaming, partitioning, or batching.

That is why `orderEventStream()` matters.
It gives the project a more honest model for large or continuous flows than pretending everything should be processed in one giant sort.
