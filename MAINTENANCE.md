# Maintenance Guide

This guide explains how to carry `causal-order` forward without relying on undocumented project memory.

The goal is not to turn every maintenance step into ceremony.
The goal is to keep the package stable, honest, and easy to evaluate while it moves from `0.x` toward `1.0.0`.

## What Must Stay Stable

When maintaining the project, protect these boundaries first:

* published package behavior
* documented default posture
* focused public entrypoints
* user-facing docs claims
* release notes and roadmap alignment

The main rule is:

> Do not quietly widen claims, change defaults, or blur uncertainty semantics.

If a change would alter any of those, it needs explicit release wording and verification.

## Repository Areas

Use the repo structure as the first orientation layer:

* `src/`
  * library runtime and exported entrypoints
* `test/`
  * direct tests and docs-sync checks
* `examples/`
  * package-facing runnable examples
* `perf/`
  * benchmark, endurance, and runtime-stability harnesses
* `guides/`
  * practical usage and workflow docs
* `wiki/`
  * conceptual explanation
* `website/`
  * surfaced docs site built from repo content

If you are unsure where work belongs, prefer:

* `guides/` for user workflows
* `wiki/` for concepts
* root or `docs/` for maintainer-only process material

## Maintenance Priorities

When choosing what to work on next, prefer this order:

1. correctness and honesty of the package surface
2. release and docs drift prevention
3. operational clarity
4. ecosystem polish
5. speculative expansion

That priority order is deliberate.
The project is more valuable when it is narrow and reliable than when it is broader but fuzzy.

## Routine Maintenance

Routine upkeep usually means:

* keep docs and examples aligned with the shipped package behavior
* keep website output aligned with the intended public boundary
* keep release metadata accurate
* keep CI checks meaningful and scoped
* keep package-size and stress signals honest

Useful commands:

```bash
npm run check
npm test
npm run docs:sync:check
npm run bench:check
npm run site:build
```

Confidence ladder:

* `CI`
  * everyday correctness and package-facing drift prevention
* `Post-Merge 150k Confidence`
  * the routine stronger automated confidence layer
* `Manual 250k Confidence`
  * heavier on-demand validation for larger batch and stream posture
* `Manual AWS Incident Confidence`
  * outage-shape streaming confidence with GC-observed summary artifacts

Treat those as different maintenance tools for different levels of confidence, not as one flat pile of workflows.

## How To Make Safe Changes

Before changing runtime behavior:

* check `README.md`
* check `CHANGELOG.md`
* check `ROADMAP.md`
* check the relevant release notes in `docs/releases/`
* check the related guide or example

Before changing website behavior:

* confirm the change belongs on the public site
* keep repo-only implementation and decision artifacts out of the site
* verify guides, wiki, and API surfaces still behave consistently

Before changing CI:

* make sure the job matches the files or checks it is responsible for
* avoid adding broad work to narrow jobs casually
* document why the workflow changed if it affects release posture

## Release Branch Expectations

For release-line work:

* use a focused branch such as `release/0.7.0`
* keep the branch scope narrow
* merge small follow-through PRs instead of batching unrelated work
* sync with `main` before continuing if part of the branch lands early

## When To Escalate A Change

Pause and write it up explicitly if a change affects:

* exported names
* default options
* confidence semantics
* anomaly semantics
* runtime support policy
* published examples or recommended usage

Those changes are not ordinary cleanup.
They alter what users can safely assume.

## What Not To Do

Avoid these maintenance patterns:

* mixing runtime changes with unrelated docs cleanup
* letting website-facing copy become release archaeology
* burying compatibility direction in commit history only
* treating exploratory pressure work as a shipped guarantee without release wording

## Success Standard

Maintenance is going well when:

* a new maintainer can find the next action without asking for oral history
* users can tell what the package does and does not claim
* release lines remain understandable after the fact
* routine follow-through does not require heroics
