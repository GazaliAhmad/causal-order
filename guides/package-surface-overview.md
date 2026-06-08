# Package Surface Overview

This guide gives a lightweight overview of the main public modules in `causal-order`.

It is not an implementation deep dive.
It is a map of the package surface so you can tell which part to use first and how the pieces fit together.
The package is meant to be the deployable ordering layer in a larger workflow, not the whole workflow by itself.
If you are evaluating whether it can be used in an actual system, the answer is yes: this is the public package surface for putting the ordering engine into that workflow.
That deployment story is not only theoretical; the repo includes heavier validation and outage-shape exercises for teams that want evidence beyond toy examples.

## The Main Shape

Most users only need to keep one flow in mind:

1. translate raw records when needed
2. order the bounded batch or stream
3. inspect the result when operators need a clearer summary

That means the main public surface revolves around three jobs:

* ingress
* ordering
* inspection

## Package Ecosystem

`causal-order` is the core runtime in the broader package ecosystem.

Companion packages can extend the runtime with focused operational capabilities without widening the payload-agnostic core package itself.

Current package-facing example:

* [`@causal-order/dedupe`](https://www.npmjs.com/package/@causal-order/dedupe): duplicate-event filtering before causal ordering

That means the main package should stay narrow and honest about ordering, while adjacent packages can handle workflow-specific preparation around that runtime.

## Ingress Layer

### `translateBatch()`

This is the raw-record entrypoint.

Use it when your source data is not already in the event-envelope shape expected by the ordering APIs.

It handles:

* field mapping
* timestamp coercion
* required versus optional field treatment
* structured translation anomalies

It does not do ordering by itself.
Its job is to prepare records for the ordering layer while keeping rejection or omission visible.

## Ordering Layer

### `orderEvents()`

This is the main bounded-batch ordering API.

Use it when you have:

* a replay slice
* an audit batch
* a finite recovery window
* an offline backlog

It returns:

* ordered output
* anomalies
* stats

### `orderEventStream()`

This is the streaming ordering API.

Use it when:

* events keep arriving
* late arrivals are normal
* you need watermark-aware output
* correction and finality are operational concerns

It emits ordered batches over time rather than one finished batch result.

## Inspection Layer

The inspection helpers sit on top of existing package output.

Use them when you want:

* compact operational summaries
* replay or audit review output
* easier operator-facing explanation

Main helpers:

* `inspectOrderResult()`
* `inspectOrderBatch()`
* `explainOrderedEvent()`
* `summarizeEventAnomalies()`
* `summarizeTranslationAnomalies()`

These helpers do not invent stronger claims than the ordering layer already made.

## Supporting Utilities

There are also narrower helpers around specific supporting needs.

Examples:

* validation helpers such as `validateEvent()`
* direct comparison helpers such as `compareByHlc()`
* clock helpers such as `createHlcClock()`
* watermark helpers for stream progress

Use these when you have a targeted need.
They are useful, but they are not the main first path for most package evaluation.

## Practical Entrypoint Choices

Use this rule of thumb:

* if the input is raw, start with `translateBatch()`
* if the workload is finite, start with `orderEvents()`
* if the workload is continuous and lateness matters, start with `orderEventStream()`
* if you already have ordering output and need summaries, add inspection helpers after that

## What This Overview Is Not

This overview is intentionally lightweight.

It is not trying to describe:

* every internal file in `src/`
* implementation details of graph traversal or tie-breaking internals
* repo organization for maintainers

Those are separate concerns.
This guide is only meant to make the public surface easier to understand from a package-user point of view.

## Best Next Step

After reading this overview:

* run an example from [Examples And Entrypoints](./examples-and-entrypoints.md)
* read [Extension Boundary Guide](./extension-boundary-guide.md) if you need to decide what should live in package-adjacent tooling versus the core runtime
* read [Quick Start Scenarios](./quick-start-scenarios.md) if you want the first-path chooser by workload
* open the [API Reference](/api/) when you want function-level detail
