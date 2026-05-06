# Roadmap

This roadmap describes how `causal-order` should mature from an experimental `0.x` library into a stable `1.0.0` npm package.

The goal is not to rush publication.
The goal is to make sure the semantics are trustworthy before the package becomes a long-term contract.

## Principles

The roadmap is guided by four constraints:

* correctness matters more than feature count
* uncertainty must be represented honestly
* streaming claims must be operationally real, not aspirational
* examples and docs are part of the product, not a cleanup task

## Platform Baseline

Current intended platform posture:

* Node.js `20+`
* ESM only
* core time representation stays primitive: `bigint` epoch milliseconds
* no `Temporal` requirement in the core package

## Release Phases

## `0.1.x` Foundation

Goal:
Make the core API real, usable, and internally consistent.

Focus:

* stabilize core TypeScript types
* harden HLC generation, merge, parse, and serialize behavior
* validate event envelopes and clocks consistently
* make `orderEvents()` usable for real small-to-medium workloads
* keep confidence semantics explicit:
  * `proven`
  * `derived`
  * `fallback`
  * `unknown`
* make `CausalEvidence` inspectable in outputs
* document strict rules for:
  * HLC-only ordering
  * `concurrent` vs `unknown`
  * parser throwing vs batch validation

Exit criteria:

* public API shape feels coherent
* basic examples work end-to-end
* early tests cover core ordering semantics
* README explains the mental model clearly

## `0.2.x` Semantics Hardening

Goal:
Pressure-test the meaning of the library, not just the syntax.

Focus:

* add tests for edge cases and regressions
* refine causal evidence rules and comparison semantics
* add replay corruption examples
* add false audit timeline examples
* add multi-region drift examples
* add offline sync anomaly examples
* make anomaly messages more useful for debugging
* clarify what counts as proven causality in difficult cases

Exit criteria:

* users can understand why outputs are labeled the way they are
* “why not just sort by timestamp?” has strong concrete answers
* tricky event sets no longer expose major semantic ambiguity

## `0.3.x` Streaming Reality

Goal:
Make streaming claims believable.

Focus:

* improve `orderEventStream()`
* harden watermark behavior
* harden late-arrival policies:
  * `flag`
  * `drop`
  * `emit_correction`
  * `fail`
* define batch correction behavior more clearly
* test bounded-memory assumptions
* add backpressure guidance and implementation behavior
* document memory strategy with concrete examples

Exit criteria:

* streaming behavior matches the documented policy
* late events are never hidden by accident
* bounded-memory operation is demonstrated, not implied

## `0.4.x` Developer Experience

Goal:
Make the package easy to adopt without reading the full spec first.

Focus:

* improve API ergonomics where it helps without weakening rigor
* add examples directory
* add a tiny CLI demo for fast hands-on evaluation, for example:
  * `npx causal-order-demo sample.jsonl`
* add JSONL adapter
* improve error messages and anomaly formatting
* add quick-start samples for:
  * audit reconstruction
  * replay pipelines
  * distributed debugging
  * offline sync inspection
* add guidance for choosing strict mode and late-arrival policies

Exit criteria:

* new users can get value from the package quickly
* examples teach the mental shift effectively
* common use cases are obvious from docs alone

## `0.5.x` Stability Candidate

Goal:
Decide whether the API is truly ready to become a stable public contract.

Focus:

* remove avoidable naming ambiguity
* review all exported types for long-term stability
* review default behaviors carefully
* identify anything still experimental and either remove it or mark it clearly
* add compatibility and migration notes
* expand test coverage around public surface area

Questions to answer before `1.0.0`:

* are confidence semantics stable enough to preserve?
* is `CausalEvidence` expressive enough?
* is streaming behavior honest and understandable?
* are anomaly types sufficient for debugging and audits?
* are the docs strong enough to prevent misuse?

Exit criteria:

* the team would feel comfortable supporting the API long-term
* major semantic churn is no longer expected

## `1.0.0` Stable Public Release

Goal:
Publish the first stable npm release.

Definition of done:

* core semantics are stable
* public API is intentional
* docs and examples are strong
* tests are meaningful
* the package clearly solves a real event-integrity problem

`1.0.0` should mean:

* consumers can depend on the semantics
* breaking changes become exceptional
* the package is ready for real production evaluation

## Post-`1.0`

Possible directions after stability:

* optional `day-boundary` integration for civil-time grouping
* audit report helpers
* incident timeline helpers
* richer adapters
* optional integration helpers for `Temporal` at the edges, not the core
* performance tuning for large streaming workloads

These should only happen if they strengthen the event integrity story.
The package should not drift into becoming a database, queue, tracing platform, or generic distributed systems framework.

## Success Criteria

This library is successful if developers stop saying:

```txt
we sorted by timestamp, so the timeline must be right
```

and start saying:

```txt
we know which event order is proven, which is inferred, and which is unknowable
```
