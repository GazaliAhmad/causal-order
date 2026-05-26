# `0.5.0` Implementation Guide

`0.5.0` opens the stability-candidate line after the published `0.4.2` developer-experience follow-through.

The published package remains `0.4.2` while this work is being shaped.
This guide is about activating the next milestone honestly, not pretending the next release has already landed.

For the broader milestone intent, see:

* [ROADMAP `0.5.x`](../../ROADMAP.md)
* [Release Notes `0.4.2`](../../docs/releases/0.4.2.md)

## Working Rule

`0.5.0` should decide contract boundaries before it adds new domain-semantic runtime surface.

If a behavior still depends on domain judgment, the repo should decide first whether it belongs in:

* the payload-agnostic core runtime
* an extension hook or policy surface
* an explicitly out-of-scope `1.0.0` area

This milestone should not let accidental implementation details become long-term contract commitments.

## Sub-Goal

`0.5.0` should turn the `0.5.x` roadmap section into a commit-friendly implementation line.

The central questions are:

* which exported names still feel ambiguous enough to rename before `1.0.0`?
* which default behaviors are safe to preserve long-term?
* which anomaly and result shapes still need compatibility notes?
* where do contradictory events, entity forks, and semantic dedupe across different IDs actually belong?

At this stage, the repo is no longer trying to prove basic usability.
It is trying to decide what should become a stable promise.

## Chunk Order

The intended landing order is:

1. public-surface inventory and naming audit
2. default-behavior and compatibility review
3. domain-semantic design notes for contradiction handling, entity forks, and semantic dedupe
4. explicit core-versus-extension-versus-out-of-scope decisions
5. migration notes and focused public-surface tests

The ordering matters.
If the repo starts implementing domain-semantic behavior before those boundaries are explicit, `0.5.0` will create accidental contract churn instead of reducing it.

## First Concrete Outputs

`0.5.0` should produce artifacts that make later implementation safer:

* an exported-surface inventory with names that still feel soft called out directly
* compatibility notes for behaviors that are intentionally preserved versus still open to refinement
* a clear decision record for:
  * contradictory-event handling
  * entity-fork handling
  * semantic dedupe across different IDs
* targeted tests for any behavior the repo starts treating as stability-candidate surface

Those outputs are more important here than squeezing in one more convenience API.

The first inventory note now lives here:

* [Exported Surface Inventory `0.5.0`](./exported-surface-inventory-0.5.0.md)

## Domain-Semantic Design Rule

The payload-agnostic core should stay honest about what it can know.

That means `0.5.0` should avoid implementing domain-semantic behavior by accident through:

* anomaly wording that quietly implies a stronger semantic claim than the runtime can justify
* merge-like duplicate handling that hides operator-visible history
* fork detection that assumes a logical entity identity model the package has not actually defined
* contradiction handling that hardcodes one domain policy as if it were universal

If the repo wants one of those behaviors before `1.0.0`, it should first say whether the behavior is:

* core
* pluggable
* intentionally unsupported

## Things To Avoid

Avoid combining these in one commit:

* naming review plus broad runtime redesign
* compatibility notes plus speculative new anomaly categories
* extension-boundary design plus merge-capable dedupe implementation
* `1.0`-sounding wording plus still-unsettled default behavior

Avoid making these decisions accidentally:

* whether a public name is stable enough to preserve
* whether a default behavior is meant to be long-term or only convenient today
* whether domain-semantic detection is core runtime logic or higher-layer policy
* whether operator visibility survives semantic dedupe decisions

## Good `0.5.0` Stopping Point

At a good stopping point, the repo should be able to say:

* which exported names and result types it expects to preserve into `1.0.0`
* which remaining semantic areas are still open and why
* which domain-semantic behaviors belong outside the `1.0.0` core claim surface unless a later chunk designs them explicitly

That is the real goal of `0.5.0`.
It should reduce semantic surprise, not just advance the version story.
