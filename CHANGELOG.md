# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0]

### Added

* built-in streaming watermark helpers: `eventTimeWatermark`, `ingestedAtWatermark`, and `createProcessingTimeWatermark()`
* direct streaming coverage for `lateArrivalPolicy: "drop"`, conservative invalid-event watermark behavior, opt-in watermark helpers, and stream option validation
* dedicated streaming recovery and resync documentation, including a correction-contract guide and a runnable reconnect example
* delayed reconnect scenario coverage for correction-capable late arrivals in streaming recovery flows
* dedicated `bench:stream` entry point and a `streaming-100k-plateaus` benchmark profile for measuring watermark-driven flush behavior directly

### Changed

* promoted the package to the `0.3.0` baseline streaming release
* kept default stream watermark progression conservative and event-driven instead of silently advancing from processing time
* stopped invalid events from advancing stream watermark progress in non-strict mode
* made `emit_correction` flush correction-capable batches immediately when a late event arrives instead of waiting for `batchSize`
* clamped computed stream watermarks at `0n` until observed progress exceeds the lateness window
* documented `emit_correction` as a correction-capable downstream model built around visible provisional output and derived-state reconciliation
* reduced ordering-path allocation overhead by validating and collecting events in a single pass before anomaly analysis
* reduced stream flush overhead by avoiding repeated buffer rescans when watermark progress and flush readiness have not changed
* extended the perf harness so streaming profiles can run through the same reporting flow as batch profiles

## [0.2.3]

### Notes

* internal repo follow-up after the published `0.2.2` release
* not intended as a separate npm publication

### Added

* after-hours batch processing guide covering scheduled replay, HLC-backed batch ordering, recommended DB table patterns, and how batch mode relates to the later streaming story

### Changed

* corrected the `0.2.x` publish history wording so the docs now distinguish:
  * published `0.2.0` baseline
  * internal `0.2.1` repo step
  * published `0.2.2` stress-hardening follow-up
* clarified the `0.3.x` roadmap to distinguish:
  * `0.2.2` batch recovery and scheduled reconciliation using HLC plus event metadata
  * `0.3.0` baseline streaming recovery semantics and the current stream-facing parameters
  * `0.3.1` edge-case streaming semantic tightening for watermark, lateness, correction, and cross-window behavior
  * `0.3.2` streaming pressure, bounded-memory demonstration, and additional hardening coverage
* improved docs cross-linking between case studies, stress hardening, and the new after-hours batch processing guide

## [0.2.2]

### Added

* completed the `150k` corrupted-dataset stress benchmark matrix and its smaller verification coverage
* added CPU profiling workflow and `.cpuprofile` capture for investigating the slowest stress cases

### Changed

* found and fixed the major ready-queue bottleneck in `orderEvents()`
* reduced duplicate validation work and trimmed anomaly-path and metadata-path overhead
* improved graph edge deduping in denser dependency cases
* aligned the README, roadmap, examples, guides, and wiki to the completed `0.2.2` stress-hardening story
* explicitly parked the next meaningful streaming optimization work under `0.3.0` instead of extending the `0.2.x` line further

## [0.2.1]

### Changed

* internal intermediate `0.2.x` repo step between the published `0.2.0` baseline and the dedicated corrupted-dataset stress-testing work later tracked as `0.2.2`

## [0.2.0]

### Added

* GitHub Actions release workflow for publishing to npm when a GitHub release is published
* dedicated fixture and scenario coverage showing that shared `traceId` and `partition` metadata do not, by themselves, imply causality
* `150k` benchmark profiles for stretch visibility beyond the current `100k` baseline, including an optional no-anomalies guard profile that is not yet enforced in `perf/check`

### Changed

* package version advanced to `0.2.0`
* npm publishing automation now uses npm trusted publishing via GitHub Actions OIDC instead of a long-lived npm token
* CI workflow now runs only for code-facing changes instead of docs, wiki, or workflow-only edits
* `.gitignore` now ignores all local `.npm-cache*` directories created during npm publish and dry-run checks
* cross-node events without explicit supported causal evidence now remain `unknown` instead of being grouped as `concurrent`
* roadmap guidance now makes `0.2.0` semantics explicit for `concurrent` vs `unknown`, and clarifies that `traceId` and `partition` remain non-causal metadata in that release line
* exported causal evidence and ordering option types now match the currently supported runtime semantics more closely, removing unsupported evidence variants and the unused `getPartition` option
* ordering hot paths now avoid repeated validated-event comparison overhead and reduce same-time bookkeeping allocation churn, substantially improving the `100k` shuffled benchmark profile
* `orderEventStream()` now precomputes buffered event times and compacts stream windows in place, significantly reducing large-stream flush overhead
* `concurrentGroups` has been removed from the current runtime API until the library can justify concurrency with stronger future evidence

## [0.1.0]

### Added

* npm release metadata including repository, homepage, bugs, keywords, author, and Node.js engine requirements
* `release:check` command for a full pre-release verification pass
* conceptual GitHub wiki pages for the first public `0.1.x` release line
* explicit validated-value types for clocks and event envelopes after successful validation

### Changed

* package version advanced to `0.1.0`
* README was rewritten to be npm-facing, with installation, package-level usage, and public documentation links
* package payload was trimmed to the essentials for npm publishing:
  * `dist`
  * `README.md`
  * `LICENSE`
* guide and wiki links in the README now resolve cleanly from a public npm package context
* package builds automatically during `prepack`
* `validateClock()` and `validateEvent()` now accept raw `unknown` input and promote successful validation results into stronger validated values
* `orderEventStream()` now surfaces malformed events as anomalies in non-strict mode instead of crashing during watermark handling
* ordering metadata now restores the intended distinction between `derived`, `fallback`, and `unknown`, including reachable `ingestion_order` and deterministic tie-break outcomes

## [0.0.6]

### Added

* expanded semantic test coverage for ordering regressions, missing dependencies, same-node conflicts, concurrency grouping, invalid-data survival, and publish-surface verification
* dedicated scale-regression perf guardrails for `10k` and `100k` workload bands
* benchmark check command for validating broad timing and memory thresholds

### Changed

* package version advanced to `0.0.6`
* `orderEventStream()` now distinguishes correction flushes from terminal finality in `emit_correction` mode
* performance tooling now includes explicit guard profiles intended to catch catastrophic regressions

## [0.0.5]

### Added

* performance benchmark harness with named profiles and CSV export support
* benchmark commands for default, full-profile, and CSV benchmark runs
* realistic workload model guidance in the README and roadmap

### Changed

* package version advanced to `0.0.5`
* `orderEvents()` now avoids double-counting duplicate causal edges when building the ordering graph
* README now documents performance benchmarking entry points

## [0.0.4]

### Added

* top-level `LICENSE` file for the MIT license
* README license section pointing to `LICENSE`

### Changed

* package version advanced to `0.0.4`
* GitHub Actions CI now skips the Node `20` and `24` test matrix for docs-only and metadata-only updates

## [0.0.3]

### Added

* guides for mental model and distributed failure modes
* runnable examples for:
  * replay corruption
  * multi-region drift
  * false audit timelines
  * offline sync anomalies
  * causal inversion
* example index and shared example helpers
* `npm run demo`
* `npm run examples`

### Changed

* package version advanced to `0.0.3`
* README now links directly to guides and runnable examples

## [0.0.2]

### Added

* scenario-based test fixtures for replay corruption, multi-region drift, false audit timelines, offline sync anomalies, and causal inversion

* GitHub Actions CI for Node `20` and `24`
* baseline automated tests for:
  * HLC parsing and serialization
  * HLC monotonicity and merge behavior
  * validation and strict mode behavior
  * ordering confidence semantics
  * streaming late-arrival policies
* scenario-first test structure with:
  * shared test helpers
  * reusable fixtures
  * unit, streaming, and scenario test coverage

### Changed

* package version advanced to `0.0.2`
* test execution now runs through a portable custom test runner suitable for the current environment

## [0.0.1]

### Added

* initial technical specification for `causal-order`
* core event integrity positioning and design principles
* HLC clock, comparison, ordering, validation, anomaly, and serialization API outlines
* explicit confidence semantics for `proven`, `derived`, `fallback`, and `unknown`
* formal `CausalEvidence` model for machine-readable causal reasoning
* strict semantics for `concurrent` versus `unknown`
* layered error-handling policy for parser APIs versus batch APIs
* streaming watermark, late-arrival, and bounded-memory strategy guidance
* documentation and adoption requirements for examples and paradigm-shift onboarding
* initial `README.md`
* initial `ROADMAP.md`
* initial `CHANGELOG.md`
* initial package scaffold with:
  * Node `20+`
  * ESM-only output
  * TypeScript build configuration
  * core exported API surface

### Notes

* `0.x` is intended for testing, iteration, and API refinement
* `1.0.0` is the target for the first stable public npm release
