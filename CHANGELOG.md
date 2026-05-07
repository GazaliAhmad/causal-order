# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

* GitHub Actions release workflow for publishing to npm when a GitHub release is published

### Changed

* npm publishing automation now uses npm trusted publishing via GitHub Actions OIDC instead of a long-lived npm token
* CI workflow now runs only for code-facing changes instead of docs, wiki, or workflow-only edits
* `.gitignore` now ignores all local `.npm-cache*` directories created during npm publish and dry-run checks

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
