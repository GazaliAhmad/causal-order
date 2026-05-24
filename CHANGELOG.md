# Changelog

All notable changes to this project will be documented in this file.

## [0.4.1]

### Added

* additive focused subpath exports for narrower public entrypoints, including `causal-order/clock`, `causal-order/compare`, `causal-order/validate`, `causal-order/anomalies`, `causal-order/order`, `causal-order/batch`, `causal-order/stream`, `causal-order/watermarks`, `causal-order/translate`, and `causal-order/types`
* direct package-surface coverage proving the new subpath exports resolve as focused runtime entrypoints
* explicit nested translation diagnostics on `TranslationAnomaly` via `diagnostic.source`, `diagnostic.classification`, `diagnostic.record`, `diagnostic.location`, and `diagnostic.contract`
* stable translation field references and anomaly classification metadata for ingress diagnostics
* explicit strictness-policy handling for translation failures, including `record_failure`, `optional_field_failure`, and exported `TranslateBatchPolicyError`
* deterministic diagnostic ordering metadata on translation anomalies, including stable record order, field order, and emitted sequence metadata
* bounded-allocation anomaly collection for batch ordering through the shared internal anomaly collector
* a non-blocking post-merge GitHub Actions confidence workflow for `150k` batch and `150k` stream validation on Node.js `20` and `24`
* detailed `0.4.1` release notes in `docs/releases/0.4.1.md`

### Changed

* kept the existing top-level `causal-order` package surface intact while adding narrower import paths for consumers who want smaller public entrypoints
* split the broader ordering surface into more focused additive entrypoints so consumers can import batch ordering, stream ordering, or watermark helpers without coming through the combined `causal-order/order` barrel
* made translation diagnostics safer for downstream tooling to build against by adding a stable `classification` object and `fieldReference` shape alongside the existing flat anomaly fields
* clarified the README install section with focused-import examples that point consumers toward narrower entrypoints without breaking current root imports
* kept heavier `150k` confidence validation out of the blocking pull-request gate by running it as a separate post-merge workflow on `main`
* added explicit policy decisions and deterministic ordering metadata to the translation diagnostic surface without widening the synchronous ingress boundary
* reduced anomaly-heavy batch allocation pressure by removing the full retained validation-record path from `orderEvents()`, making graph evidence lazy, and trimming intermediate ordering structures
* aligned the README, roadmap, guides, wiki, package metadata, and release notes around `0.4.1` as the published structural-diagnostics and bounded-allocation follow-through release

## [0.4.0]

### Added

* the first public synchronous raw-record ingress surface via top-level `translateBatch()`
* public ingress-facing translation types for translated envelopes, mapper configuration, structured translation anomalies, and translated-versus-rejected batch results
* direct unit coverage for the first `0.4.0` ingress contract surface

### Changed

* finalized the first published ingress contract around explicit mapper rules, deterministic timestamp coercion, structured translation anomalies, and shallow translated-envelope immutability with payload preservation by reference
* aligned the README, guides, wiki, roadmap, changelog, and website around `0.4.0` as the published ingress release and the current Node/runtime posture
* added detailed `0.4.0` release notes in `docs/releases/0.4.0.md`

## [Website]

### Changed

* website refinements without a package version bump, including docs navigation cleanup, mobile docs polish, SEO/PWA metadata updates, and generated API reference improvements
* rebuilt the docs-site API reference to derive its function pages and overview groups from the actual public export surface while keeping navigation focused on primary entry points
* added detailed website notes in `docs/releases/website.md`

### Notes

* the website notes also include the `translateBatch()` API-reference surfacing, the published `0.4.0` docs-navigation updates, and the README banner layout fix

## [0.3.4]

### Added

* explicit `0.3.4` stream runtime-stability documentation plus dedicated stream endurance runners and sustained `150k` endurance profiles
* generated API reference metadata and fuller API index coverage for the docs site

### Changed

* aligned the README, runtime-stability docs, docs-site API surface, and build compatibility around `0.3.4` as the published runtime-stability line
* added detailed `0.3.4` release notes in `docs/releases/0.3.4.md`

## [0.3.3]

### Added

* the first Astro-based documentation website under `website/`, including public guides, wiki, API, privacy, and 404 surfaces
* broader `0.3.3` stream-pressure visibility through named stress profiles, exploratory fuzz coverage, and richer benchmark reporting

### Changed

* refined the docs-site shell and homepage, clarified the `0.3.3` stream-pressure posture, and hardened the streaming benchmark story around the `150k` guard band
* improved `orderEventStream()` under watermark-lag and anomaly-heavy pressure by reducing rescans and merge overhead
* added detailed `0.3.3` release notes in `docs/releases/0.3.3.md`

## [0.3.2]

### Added

* explicit `0.3.2` production-gate documentation for the current release line
* direct release-gate coverage for the current-core hardening categories:
  * missing parent events
  * offline device merge
  * duplicate event storms for exact duplicate IDs
  * clock reset scenarios
  * massive out-of-order replay
  * partial log corruption
* direct streaming release-gate pressure coverage for:
  * pathological late arrivals
  * reconnect correction pressure
  * watermark pressure
  * lagging-watermark plus `batchSize` pressure
  * bounded-memory cross-window behavior
* seeded batch fuzz coverage for outage, replay, duplicate, drift, and corruption noise
* seeded streaming reconnect fuzz coverage for reproducible late-arrival and correction behavior
* explicit anomaly-surface audit documentation for the `0.3.2` production gate
* dedicated fuzz-testing documentation in `guides/` plus a matching conceptual wiki page

### Changed

* aligned the README, guides, roadmap, and wiki around the `0.3.2` production-gate hardening story
* clarified that the current fuzz layer is part of the `0.3.2` release gate while broader exploratory fuzz campaigns remain part of `0.3.3`
* narrowed CI to pull requests into `main` so merged PRs do not rerun the same matrix after passing branch validation
* updated CI path filtering so workflow changes count as code-facing changes while docs-only PRs still skip the test matrix

## [0.3.1]

### Added

* explicit streaming contract coverage for custom watermark signal semantics and the equality boundary between `ready` output and `late` output
* machine-readable correction notices on streaming batches via `batch.correction` for `lateArrivalPolicy: "emit_correction"`
* explicit streaming anomaly-horizon metadata via `batch.anomalyHorizon` covering the current `buffered_window_only` retained-history contract and `late_arrival_only` cross-window relational detection
* targeted streaming coverage for non-trivial `batchSize` behavior, including lagging-watermark flush attempts, ready-subset emission, and reconnect correction fragmentation when `batchSize` is small
* additional reconnect scenario coverage showing correction-capable batches, retained anomaly-horizon semantics, and multi-batch delayed-sync behavior

### Changed

* tightened the `0.3.1` streaming semantics around watermark callbacks so custom `watermark` functions are described as stream-progress signals rather than as the final emitted watermark directly
* made the boundary contract explicit that events with `eventTime <= batch.watermark` are ready to flush while events with `eventTime < batch.watermark` are late
* documented `emit_correction` more precisely as a policy-based reconciliation model whose current correction scope may reach any previously emitted non-final output in the same stream instance
* documented the current cross-window anomaly contract more explicitly:
  * emitted history is not retained for later duplicate, sequence-regression, same-node-sequence-conflict, causal-inversion, or unknown-order comparison
  * cross-window relational anomaly carry is currently limited to operational `late_arrival`
* clarified the current `batchSize` contract:
  * `batchSize` triggers a safe flush attempt rather than forcing unready events out
  * lagging-watermark cases may emit nothing or only the ready subset
  * correction-triggered reconnect flushes may exceed nominal `batchSize`
* strengthened downstream guidance for mutable, append-only, non-transactional, and partially transactional sinks so non-final output is treated as replaceable derived state and `batch.correction` is treated as a reconciliation signal rather than a patch payload
* rewrote the README, guides, and wiki positioning to emphasize the safest honest claim:
  * the library is designed for distributed systems that cannot rely on a globally synchronized clock
  * it supports deployment-oriented event integrity without claiming globally complete ordering or universal production proof
* expanded the operational documentation to describe realistic server-down deployment windows where central systems may be unavailable for `4` to `8` hours while individual nodes continue locally and sync later
* reframed the `150k` stress band as a plausible real-world backlog envelope for delayed sync and bounded replay rather than only as an abstract benchmark tier

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

### Added

* after-hours batch processing guidance covering scheduled replay, HLC-backed batch ordering, recommended DB table patterns, and how batch recovery differs from the later streaming recovery story

### Changed

* corrected the `0.2.x` publish history wording so the docs present the public release line more cleanly
* clarified the roadmap handoff between `0.2.2` batch recovery guidance and the later `0.3.0` streaming recovery surface
* improved docs cross-linking between case studies, stress hardening, and after-hours batch processing guidance

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

## [0.2.0]

### Added

* GitHub Actions release workflow for publishing to npm when a GitHub release is published
* dedicated fixture and scenario coverage showing that shared `traceId` and `partition` metadata do not, by themselves, imply causality
* `150k` benchmark profiles for stretch visibility beyond the current `100k` baseline, including an optional no-anomalies guard profile that is not yet enforced in `perf/check`

### Changed

* package version advanced to `0.2.0`
* npm publishing automation now uses npm trusted publishing via GitHub Actions OIDC instead of a long-lived npm token
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
