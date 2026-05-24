# `0.4.1` Implementation Guide

`0.4.1` is now a published release.
This document is a historical implementation note for that published release, focused on what actually landed in the repository.

For the broader milestone intent, see:

* [ROADMAP `0.4.0`](../../ROADMAP.md)
* [Developer Experience `0.4.0`](./developer-experience-0.4.0.md)

## Release Summary

`0.4.1` completes the diagnostics and policy follow-through on the `0.4.0` raw-record ingress contract.

If `0.4.0` defined how raw records enter the package, `0.4.1` defines how translation and structural failures are exposed, classified, controlled, and benchmarked under anomaly-heavy pressure.

The published release landed in six scoped chunks:

1. structured diagnostic objects for mapping and structural failures
2. stable classification and field-reference shape
3. strictness-policy granularity for fail-fast, warning, or continuation decisions
4. deterministic diagnostic ordering guarantees
5. allocation-discipline follow-through under anomaly-heavy pressure
6. docs and release wording

## What Landed

### 1. Structured Diagnostic Objects

`TranslationAnomaly` now carries a nested `diagnostic` object with explicit:

* source
* record
* location
* contract

This makes mapping and structural failures inspectable without scraping free-form message text.

### 2. Stable Classification And Field References

The translation anomaly surface now includes stable:

* `classification`
* `fieldReference`

That gives downstream tooling a reliable machine-readable taxonomy for ingress-facing failures.

### 3. Strictness Policy

`translateBatch()` now exposes explicit policy controls rather than treating structural handling as incidental behavior.

The published policy surface includes:

* `record_failure`
* `optional_field_failure`
* exported `TranslateBatchPolicyError`

### 4. Deterministic Ordering

Translation anomalies are now emitted in deterministic order for identical input.

That ordering is explicit through:

* record order
* field evaluation order
* emitted anomaly sequence metadata

### 5. Allocation Discipline

The anomaly-heavy path also received bounded-allocation follow-through.

The main implementation changes were:

* a shared internal anomaly collector for batch ordering
* removal of the retained full validation-record path from `orderEvents()`
* lazy graph-evidence allocation
* reduced intermediate ordering structures in `orderValidatedEvents()`

This keeps the anomaly-heavy batch path operationally cheaper without changing the public ordering contract.

### 6. Docs And Release Wording

The repo now describes `0.4.1` in published-release terms across:

* `README.md`
* `ROADMAP.md`
* `CHANGELOG.md`
* `guides/README.md`
* `wiki/Home.md`
* `wiki/What-This-Library-Is.md`
* `docs/releases/0.4.1.md`

## Release Boundary

`0.4.1` remains a diagnostics and policy release for the current synchronous ingress boundary.

It does not widen the core package into:

* async translation APIs
* stream translation helpers
* filesystem-backed ingestion helpers
* CLI or terminal rendering layers
* connector or adapter surfaces

## Outcome

At the published `0.4.1` stopping point, the package now has:

* structured failure objects
* stable classification
* explicit policy choices
* deterministic diagnostic output rules
* evidence that the anomaly-heavy path is more allocation-disciplined than the earlier implementation

The next developer-experience follow-through release is `0.4.2`, focused on examples and documentation synchronization rather than further widening the core package surface.
