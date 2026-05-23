# `0.4.0` Developer Experience

`0.4.0` is the release where `causal-order` makes the core package easier to adopt without weakening the payload-agnostic boundary that the current contract depends on.

This guide records the `0.4.0` developer-experience release.
It does not redefine the causal semantics established in the earlier `0.3.x` hardening work.

## Goal

`0.4.0` lets a new user make one simple claim:

> I can map my data into the core event model, understand what the package will accept or reject, and evaluate the current behavior without first building my own glue layer

That is different from turning the core package into a CLI, file loader, or environment-specific integration bundle.

## What This Milestone Is

The published `0.4.0` release is about:

* a clearer public ingress boundary between user-space data and the core event envelope
* keeping that ingress boundary synchronous and environment-free for the `0.4.0` ingress contract

The broader developer-experience follow-through around that published `0.4.0` line also includes:

* better structured diagnostics for mapping and validation failures
* stronger quick-start and scenario guidance for the current public API
* self-contained examples that rely only on native Node.js and the published package surface
* tighter docs synchronization so the examples and public wording stay aligned

`0.4.0` is not about widening the core package into an environment-aware toolkit.

It is also not about quietly widening the package surface through convenience pressure.
If a capability changes the shape of the public ingress contract, the repo should treat that as contract work, not as lightweight DX polish.

## `0.4.0` Release Shape

`0.4.0` now has the first ingress contract in place.

That currently means:

* `translateBatch()` exists as the top-level synchronous raw-record ingress surface
* accepted records are split from structured translation anomalies explicitly
* mapper behavior, timestamp coercion, and ownership rules are now narrow enough to document directly
* the practical examples now show the real path from raw records into `orderEvents()` rather than a helper-only aspirational flow

Follow-up `0.4.1` and `0.4.2` work beyond `0.4.0` is therefore:

* `0.4.1` continues the diagnostics and policy surface
* `0.4.2` continues the examples and docs synchronization surface

## Architectural Boundary

The core repository should remain:

* zero external runtime dependencies
* free of CLI binaries
* free of filesystem access
* free of environment orchestration logic
* payload-agnostic with respect to business-domain structure

That means the core package may help users translate data into the causal envelope, but it should not become the place where local files, terminal rendering, text-format adapters, or developer shells live.

Those concerns belong in companion tooling or later ecosystem work built strictly on the public npm API.

## Ingestion Design Rules

For the published `0.4.0` ingress surface, the intended shape is direct mapping from user-space records into `translateBatch()`, not a wrapper-heavy mini-framework in front of it.

Good `0.4.0` ingestion design usually means:

* mapper functions read from the original input record directly
* any pre-translation normalization stays small, local, and cheap
* `translateBatch()` remains the place where coercion, rejection, and translation anomalies are decided

Poor `0.4.0` ingestion design usually means:

* building a new per-record "almost-envelope" object before calling `translateBatch()`
* copying payloads or metadata collections just to reshape them for mapper convenience
* burying field validation or timestamp handling in transient adapter objects instead of letting the public ingress contract own it

That kind of slop does not make the architecture useless, but it does give back avoidable allocation pressure and contract clarity right at the boundary `0.4.0` was meant to make explicit.

## `0.4.0` Follow-Through

`0.4.0` also points at two explicit follow-through releases, with `0.4.1` and `0.4.2` continuing the same developer-experience track:

### `0.4.0` Public Ingress Contract Definition

The core package now defines a narrow, defensible ingress contract between arbitrary user-space data and the strict immutable causal envelope.

This published step is not just a helpful `translateBatch()` entry point.
It is the release where users can rely on:

* coercion guarantees
* anomaly taxonomy
* mapper semantics
* payload preservation
* ownership and immutability rules

### `0.4.1` Structural Diagnostics And Bounded-Allocation Anomalies

The core package should make translation and structural failures more inspectable as machine-readable contract surface without turning diagnostics into a heavy formatting subsystem.

This step is not just about nicer error text.
It is about deciding what downstream tooling may rely on around:

* anomaly names
* field references
* policy keys
* deterministic anomaly output
* anomaly-heavy operational cost

### `0.4.2` Self-Contained Recipes And Documentation Synchronization

The repo should prove that the current ingress and diagnostic contracts are teachable and runnable through the real public package surface while staying inside the current architectural boundary.

This step is not just about adding examples.
It is about showing that:

* examples can use the real public API directly
* docs do not need shadow abstractions to make the package look smoother than it is
* a new user can evaluate the package honestly without hidden helper layers

## Current Boundary Rule

Before `1.0.0`, `0.4.0` and its immediate follow-through keep these out of the core repository:

* JSONL or other file-format ingestion adapters
* async translation APIs
* async iterables or async-generator ingestion surfaces
* stream translation layers or backpressure-aware ingestion helpers
* CLI binaries and terminal rendering surfaces
* broker connectors or database connectors
* filesystem-backed evaluation flows
* domain-aware payload reducers or merge layers

If a feature needs those concerns, it likely belongs in a companion repository or in post-`1.0` ecosystem work rather than in the core package itself.

For the `0.4.0` contract specifically, the default assumption is:

* synchronous ingress only
* no async translation contract
* no backpressure-aware ingestion contract

None of those convenience pressures should creep into follow-up `0.4.1` and `0.4.2` PRs through helper layers.

That means:

* no filesystem or stream helpers whose real purpose is to feed arrays into `translateBatch()`
* no `Promise.all` or `async` / `await` inside the translation pipeline
* no terminal-specific or pretty-printed diagnostic output becoming the primary contract surface

## Public Contract Stability

`0.4.0` introduces new public ingress-facing types and functions without implying that they are fully stable in the `1.0` sense.

Before `1.0.0`, the repo should be explicit that the following surfaces may still see deliberate refinement during `0.4.1` and `0.4.2` follow-through work:

* `translateBatch()`
* mapper shape
* anomaly names
* policy keys
* timestamp coercion behavior

The important rule is that this new public surface should not be treated as silently soft-stable by default.

If maintainers want to preserve a behavior across future `0.4.1` and `0.4.2` releases, they should say so explicitly.
If a behavior is still under active contract design, the docs should say that too.

This section exists to prevent accidental long-term promises before the package reaches `1.0.0`.

## Exit Criteria

By the end of `0.4.2`, these should feel true:

* new users can map realistic input data into the public core contract without custom type-assertion glue
* the package ingress contract is explicit enough that downstream tooling is not forced to learn it by accident
* diagnostics make invalid or unsupported input easier to understand
* self-contained examples teach the package's mental shift effectively without introducing shadow abstractions
* common current-core use cases are obvious from docs alone
* developer experience improved without violating the zero-dependency, payload-agnostic core boundary

## What This Work Is Not

This work is not:

* a move toward domain-specific payload semantics
* a move toward core-repo file parsing and orchestration
* a move toward internal-only helper APIs that downstream tooling must depend on
* a claim that the core package should absorb companion CLI responsibilities

It is developer-experience work for the current core package surface.
