# `0.4.1` Implementation Guide

This note records the `0.4.1` work in a scoped, commit-friendly shape.

The main sequencing for `0.4.1` is:

* make the diagnostic contract explicit first
* add policy control second
* tighten determinism, cost, and wording only after the new surface is real

For the broader milestone intent, see:

* [ROADMAP `0.4.0`](../../ROADMAP.md)
* [Developer Experience `0.4.0`](./developer-experience-0.4.0.md)

## Working Rule

`0.4.1` should treat diagnostics as follow-through on the `0.4.0` ingress contract, not as a generic “better errors” pass.

If `0.4.0` defines how raw records enter the package, `0.4.1` defines how translation and structural failures are exposed, classified, and controlled once that ingress path exists.

This work should stay split between a few clearly different layers:

* mapping-diagnostic object shape
* stable anomaly classification
* strictness-policy surface
* deterministic anomaly ordering
* allocation-discipline checks
* docs and release wording

The repo should avoid landing those as one large diagnostic rewrite.

This is the point where a helpful DX milestone can become noisy very quickly.
If the same change set rewrites error structure, adds policy switches, changes ordering guarantees, and claims it is all already cheap enough under pressure, the result will be harder to trust than to use.

## Sub-Goal

`0.4.1` should define a stable inspection and policy surface around the ingress contract without turning diagnostics into a heavy formatting layer or a pseudo-UI subsystem.

The repo should stay disciplined here:

* do not start by adding rich rendering layers
* do not start by adding external formatting dependencies
* do start by making the machine-readable diagnostic contract explicit, stable, and narrow enough to defend

What matters most is not whether the messages are wordier.
What matters is whether downstream tooling and tests can reason about failures without scraping free-form text.

This milestone is about observability and policy control for the current core surface, not about CLI presentation or developer-console polish.

The main contract questions are:

* what anomaly categories exist?
* which fields are stable enough for tooling to rely on?
* what handling policies are part of the public contract?
* how deterministic is the anomaly output for identical input?
* how much runtime cost is acceptable for anomaly-heavy paths?

## Chunk Order

The intended landing order is:

1. structured diagnostic objects for mapping and structural failures
2. stable classification and field-reference shape
3. strictness-policy granularity for fail-fast, warning, or continuation decisions
4. deterministic diagnostic ordering guarantees
5. allocation-discipline checks under anomaly-heavy pressure
6. docs and release wording

The early chunks should settle the contract questions first:

* can tooling inspect failures without parsing free-form strings?
* are anomaly categories stable enough for downstream consumers to key against?
* do identical inputs produce identical diagnostic records?
* can developers choose stricter or softer structural handling without changing the core boundary?
* do anomaly-heavy runs stay operationally disciplined enough to defend the new surface?

Only after that contract is clear should the repo strengthen the wording around diagnostic stability or strictness behavior.

At a good `0.4.1` stopping point, the repo should have something smaller and more defensible than a broad “better errors” claim:

* structured failure objects
* stable classification
* explicit policy choices
* deterministic output rules
* evidence that the anomaly-heavy path did not become recklessly expensive

The key is that `0.4.1` should make diagnostics safe to build against, not merely nicer to read.

## PR Guardrails

`0.4.1` should not let diagnostic ergonomics drift into presentation-specific convenience code.

During this milestone, PRs should reject additions such as:

* pretty-printed error strings as the main diagnostic contract
* terminal-specific logging logic
* formatter-first diagnostics that bury or replace the machine-readable anomaly surface

If a proposed diagnostic improvement is easier to consume in a terminal but harder to consume as structured data, it is probably in the wrong layer for the core package.

## Things To Avoid

Avoid combining these in one commit:

* diagnostic-schema work plus unrelated translation-surface expansion
* strictness-policy work plus new environment adapters
* allocation-discipline checks plus speculative formatting layers
* deterministic-ordering guarantees plus unrelated runtime-hardening work
* anomaly-taxonomy changes plus unrelated convenience helpers
* docs wording plus unverified diagnostic stability claims

Avoid making these decisions accidentally:

* whether anomaly names are stable enough for downstream tooling
* whether `index` and `field` are required, optional, or situational
* whether mapper failures and structural failures live in the same taxonomy
* whether policy handling is per-anomaly-type or only globally configurable
* whether anomaly-heavy execution remains cheap enough to recommend broadly
