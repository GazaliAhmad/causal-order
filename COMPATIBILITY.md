# Compatibility Policy

This document explains what `causal-order` tries to preserve now that the package has reached `1.0.0`, and how to think about compatibility claims on the stable line.

## Current Policy

`causal-order` is now on its stable public line.
That means the documented package-facing surface is treated as preserved unless there is explicit release wording saying otherwise.

That does not mean every internal detail is frozen.
It does mean changes are not casual.

## What The Project Tries To Preserve

Preserve these by default:

* documented user-facing entrypoints
* documented default option posture
* confidence labels and their meaning
* anomaly categories that users are told to rely on
* package-facing examples and recommended workflow shape

If any of these need to change, the change should include:

* explicit release wording
* migration guidance when relevant
* docs and example updates in the same change

## What May Still Evolve More Freely

These can still move more freely, as long as the release wording stays honest:

* internal implementation structure
* maintainer-only docs and repo organization
* website presentation details
* exploratory benchmark and stress harnesses
* helper additions that do not narrow or silently change existing behavior

## Runtime Policy

Current package support:

* published npm package support: Node.js `>=20`
* active repository development target: Node.js `24`
* Node.js `18` CI coverage is regression-oriented validation, not the main support contract

If this policy changes, update:

* `README.md`
* `CONTRIBUTING.md`
* release notes

## Default Posture Policy

Defaults are part of compatibility.

Do not change defaults such as strictness or anomaly posture casually.
If a default changes, the release must explain:

* what changed
* why it changed
* how users should adapt

## Naming And EntryPoint Policy

Preferred names should stay stable once documented as the main path.

Compatibility aliases may exist for a while, but they should not create ambiguity about the preferred public surface.

When introducing a preferred replacement:

* keep the old path only when it reduces migration pain
* document the preferred path clearly
* avoid letting multiple names look equally canonical forever

Current direction:

* primary names are the documented path for new code
* compatibility aliases are transitional surface, not equally canonical alternatives
* focused subpaths should expose primary names rather than keep deprecated aliases looking like first-class entrypoints forever
* the root `causal-order` import should tell the same primary API story as the focused subpaths

## Docs As Compatibility Surface

For this project, docs are part of compatibility.

That includes:

* what the README tells users to import
* what the guides tell users to rely on
* what the website presents as the current supported path

If the code and docs disagree, fix both.
Do not treat the docs as optional polish.

## Unsupported And Out-Of-Scope Usage

The package should be explicit when something is not supported rather than leaving users to infer support accidentally.

Examples of things that may remain intentionally unsupported or out of scope:

* domain-semantic contradiction resolution inside the payload-agnostic core
* pretending timestamp order alone proves causality
* environment-specific transport or file parsing glue inside the core package

The policy is:

> unsupported is acceptable; ambiguous support is not.

## Release Expectations

Compatibility changes on the stable line are acceptable only when they are:

* explicit
* documented
* justified

Silent drift is the thing to avoid.

## Success Standard

Compatibility policy is working when:

* users can tell what they can safely build against
* maintainers know when a change needs migration wording
* release lines do not surprise careful adopters
