# Changelog

All notable changes to this project are summarized here.
Detailed release write-ups live in `docs/releases/`.

## [0.5.1] - Unreleased

* This version is not published to npm.
* Polished post-`0.5.0` release artifacts and clarified that the exported-surface inventory is historical audit context, not an active release gate.
* Removed implementation-oriented and build-oriented internal guides from the public website docs surface and simplified the guide navigation.
* Refined README badge posture around CI labeling and package-size reporting.

## [0.5.0]

* Published the stability-and-contract-design release line.
* Established `compareByHlc()` and `compareDeterministically()` as the preferred helper names while keeping compatibility aliases.
* Preserved warning-visible defaults such as `strict: false`, `detectAnomalies: true`, and translation optional-field `"warn"` posture.
* Made the payload-agnostic core boundary explicit for contradiction handling, entity forks, and semantic dedupe.
* Details: `docs/releases/0.5.0.md`

## [0.4.2]

* Completed the developer-experience follow-through around runnable ingress examples, policy guidance, and docs synchronization.
* Aligned the README, guides, wiki, roadmap, and examples around the package-facing `translateBatch()` to `orderEvents()` path.
* Added docs-sync enforcement and release-facing verification wiring.
* Details: `docs/releases/0.4.2.md`

## [0.4.1]

* Added focused public subpath exports such as `causal-order/clock`, `compare`, `validate`, `order`, `stream`, `watermarks`, `translate`, and `types`.
* Strengthened translation diagnostics with stable classification, field-reference, and policy-error structures.
* Reduced anomaly-heavy batch overhead and expanded confidence validation around the released package surface.
* Details: `docs/releases/0.4.1.md`

## [0.4.0]

* Published the first public raw-record ingress surface through top-level `translateBatch()`.
* Added ingress-facing translation types, structured anomalies, and direct contract coverage.
* Aligned package docs and website posture around the released ingress surface.
* Details: `docs/releases/0.4.0.md`

## [Website]

* Captured website-only refinements without a package version bump.
* Improved docs navigation, generated API reference structure, mobile polish, and metadata.
* Details: `docs/releases/website.md`

## [0.3.4]

* Added explicit runtime-stability documentation and sustained stream endurance runners.
* Expanded generated API-reference coverage for the docs site.
* Aligned package and docs posture around the `0.3.4` runtime-stability line.
* Details: `docs/releases/0.3.4.md`

## [0.3.3]

* Added the first Astro-based documentation website.
* Expanded stream-pressure visibility through named stress profiles, fuzz coverage, and richer benchmark reporting.
* Hardened `orderEventStream()` under watermark-lag and anomaly-heavy pressure.
* Details: `docs/releases/0.3.3.md`

## [0.3.2]

* Added the production-gate hardening release around missing parents, offline merge, duplicate storms, clock reset, replay disorder, and corruption scenarios.
* Added seeded batch and streaming fuzz coverage plus anomaly-surface audit guidance.
* Narrowed CI behavior and aligned the docs story around the `0.3.2` hardening line.
* Details: `docs/releases/0.3.2.md`

## [0.3.1]

* Tightened the streaming contract around watermark semantics, correction notices, anomaly horizon, and `batchSize` behavior.
* Expanded reconnect and late-arrival coverage for correction-capable flows.
* Repositioned the docs around honest distributed-systems claims instead of false global-order promises.
* Details: `docs/releases/0.3.1.md`

## [0.3.0]

* Published the first streaming baseline with built-in watermark helpers and explicit late-arrival policies.
* Added streaming recovery guidance, reconnect examples, and dedicated streaming benchmark entry points.
* Reduced ordering and stream flush overhead in the main hot paths.
* Details: `docs/releases/0.3.0.md`

## [0.2.3]

* Added after-hours batch processing guidance for scheduled replay and recovery workflows.
* Clarified the `0.2.x` publish history and the handoff toward later streaming recovery work.
* Improved cross-linking between guides, hardening notes, and case studies.
* Details: `docs/releases/0.2.3.md`

## [0.2.2]

* Completed the `150k` corrupted-dataset stress matrix and added CPU profiling workflow support.
* Fixed a major ready-queue bottleneck in `orderEvents()` and reduced repeated validation overhead.
* Parked the next meaningful streaming optimization work under `0.3.0`.
* Details: `docs/releases/0.2.2.md`

## [0.2.0]

* Added GitHub Actions release publishing, stronger causal-evidence fixtures, and `150k` benchmark profiles.
* Clarified the `concurrent` versus `unknown` contract for unsupported cross-node evidence.
* Tightened exported ordering types and improved ordering and stream hot-path performance.
* Details: `docs/releases/0.2.0.md`

## [0.1.0]

* Published the first npm-facing package metadata and release-check workflow.
* Rewrote the README for package consumers and added the first conceptual wiki pages.
* Strengthened validated-value promotion for `validateClock()` and `validateEvent()`.
* Details: `docs/releases/0.1.0.md`

## [0.0.6]

* Expanded semantic ordering test coverage and added scale-regression perf guardrails.
* Added benchmark-check commands for timing and memory thresholds.
* Clarified streaming correction versus finality behavior.

## [0.0.5]

* Added the first benchmark harness with named profiles and CSV export support.
* Documented realistic workload expectations in the README and roadmap.
* Improved graph-edge deduping in `orderEvents()`.

## [0.0.4]

* Added the top-level MIT `LICENSE`.
* Pointed the README license section at the published license file.
* Tightened CI so docs-only and metadata-only changes skip the full test matrix.

## [0.0.3]

* Added the first guides, runnable examples, shared example helpers, and demo commands.
* Linked the README directly to guides and examples.
* Established the first scenario-driven docs layer around replay, drift, audit, offline sync, and inversion cases.

## [0.0.2]

* Added the first scenario-based fixtures plus baseline CI and test coverage for clocks, validation, ordering, and streaming policies.
* Introduced the custom portable test runner and shared test helpers.
* Established the initial scenario-first test structure.

## [0.0.1]

* Created the initial technical specification, package scaffold, README, roadmap, and changelog.
* Defined the first confidence model, causal-evidence model, error-handling rules, and streaming guidance.
* Established the `0.x` iteration posture ahead of the eventual `1.0.0` stable release.
