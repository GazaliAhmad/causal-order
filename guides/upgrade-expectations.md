# Upgrade Expectations

This guide explains what users should expect when upgrading `causal-order` before `1.0.0`.

The package is still in `0.x`, so not every surface is equally frozen.
But upgrades should still be explicit, documented, and understandable.

## What The Project Tries To Preserve

The project already tries to preserve some boundaries by default.

The most important ones are:

* documented user-facing entrypoints
* documented default option posture
* confidence labels and their meaning
* anomaly categories that users are told to rely on
* package-facing examples and recommended workflow shape
* published runtime floor for the npm package

If any of those change, you should expect release wording and matching docs updates rather than a quiet drift.

## What May Still Change More Freely

Before `1.0.0`, these areas can still move more freely:

* internal implementation structure
* maintainer-only docs
* repository organization
* website presentation details
* additive helper surface that does not silently narrow or reinterpret existing behavior

That means an upgrade may still rearrange internals or presentation, but it should not casually rewrite the package-facing contract without saying so.

## What Should Make You Read Release Notes Carefully

Treat an upgrade as more than routine if it changes:

* exported names or preferred import paths
* default strictness or anomaly posture
* confidence semantics
* anomaly semantics
* translation policy behavior
* runtime support policy
* recommended workflow shape in the guides or README

Those are the places where careful users are building assumptions.

## Safe Upgrade Workflow

If you are upgrading across release lines, use a simple check path:

1. read `CHANGELOG.md`
2. read the matching release notes if the line is larger than a patch
3. re-run the guide or example closest to your real usage shape
4. re-check focused imports if you use subpath entrypoints
5. re-check translation-policy and anomaly-handling expectations if you rely on them operationally
6. confirm your runtime still matches the published Node.js support floor

If your workflow depends heavily on:

* strict rejection
* anomaly names
* translation-policy posture
* stream finality or reconciliation behavior

then your upgrade review should be more deliberate than just "tests still pass."

## EntryPoint Tightening Toward `1.0.0`

The package already distinguishes between:

* primary names that new code should prefer
* compatibility aliases that still exist so older code does not break abruptly

That distinction becomes more important as the project moves toward `1.0.0`.

The expected direction is:

* primary names stay stable and remain the documented first path
* compatibility aliases stop looking equally canonical
* focused subpaths already tighten around the primary public names instead of preserving every older alias forever
* the root import may still keep compatibility aliases longer than the narrower subpaths

If you are writing new code today, prefer the documented primary names now so the `1.0.0` transition is smaller later.

## What To Expect From Patch Releases

Patch releases should usually feel narrow.

You should mainly expect:

* docs cleanup
* website polish
* metadata or release-process fixes
* narrowly scoped bug fixes

If a patch release affects public behavior in a meaningful way, the release wording should make that obvious.

## What To Expect Before `1.0.0`

Pre-`1.0.0` does not mean "everything is unstable."
It means:

* some surfaces are already treated as preserved unless explicitly changed
* some surfaces still have room to tighten or clarify
* some compatibility aliases may still exist even though the documented primary names are already decided
* the project wants explicit compatibility direction instead of accidental long-term promises

So the right expectation is:

* upgrades may still require attention
* surprise should be avoided
* silent contract drift is the thing the project is trying hardest not to do

## If You Need Very Strict Upgrade Guarantees

If your environment needs minimal change risk:

* pin exact versions instead of floating broadly
* read the changelog before bumping
* validate against your real replay, stream, or anomaly-handling workflow
* prefer documented primary entrypoints and names over older compatibility aliases

That approach fits the current maturity level better than assuming every `0.x` release behaves like a post-`1.0` maintenance line.

## Practical Rule

Use this rule when upgrading:

> trust the current documented surface, read the release wording when that surface changes, and do not rely on undocumented behavior just because it happened to work once.

That is the safest way to benefit from the package while it is still moving toward `1.0.0`.
