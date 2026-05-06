# Changelog

All notable changes to this project will be documented in this file.

The project is currently in pre-release `0.x` development and has not been published to npm.

## [Unreleased]

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
