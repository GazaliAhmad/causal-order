# `0.5.0` Implementation Guide

`0.5.0` is the published stability-and-contract-design release after the `0.4.2` developer-experience follow-through.

This guide now serves as the implementation record for how that release line was shaped.
The next active milestone has moved on to `0.6.x`.

For the broader milestone intent, see:

* [ROADMAP `0.5.x`](../../ROADMAP.md)
* [Release Notes `0.5.0`](../../docs/releases/0.5.0.md)

## Working Rule

`0.5.0` decided contract boundaries before adding new domain-semantic runtime surface.

If a behavior still depends on domain judgment, the repo should decide first whether it belongs in:

* the payload-agnostic core runtime
* an extension hook or policy surface
* an explicitly out-of-scope `1.0.0` area

This milestone does not let accidental implementation details become long-term contract commitments.

## Sub-Goal

`0.5.0` turned the `0.5.x` roadmap section into a commit-friendly implementation line.

The central questions are:

* which exported names still feel ambiguous enough to rename before `1.0.0`?
* which default behaviors are safe to preserve long-term?
* which anomaly and result shapes still need compatibility notes?
* where do contradictory events, entity forks, and semantic dedupe across different IDs actually belong?

At this stage, the repo is no longer trying to prove basic usability.
It is recording what became a stable promise for the released line.

## Chunk Order

The release landed in this order:

1. public-surface inventory and naming audit
2. default-behavior and compatibility review
3. domain-semantic design notes for contradiction handling, entity forks, and semantic dedupe
4. explicit core-versus-extension-versus-out-of-scope decisions
5. migration notes and focused public-surface tests

The ordering mattered.
If the repo starts implementing domain-semantic behavior before those boundaries are explicit, `0.5.0` will create accidental contract churn instead of reducing it.

## Concrete Outputs

`0.5.0` produces artifacts that make later implementation safer:

* an exported-surface inventory with names that still feel soft called out directly
* compatibility notes for behaviors that are intentionally preserved versus still open to refinement
* draft payload-agnostic extension interfaces that prove later policy hooks can stay outside the core event payload contract
* a clear decision record for:
  * contradictory-event handling
  * entity-fork handling
  * semantic dedupe across different IDs
* targeted tests for any behavior the repo treats as released stability surface

Those outputs are more important here than squeezing in one more convenience API.

The first inventory note now lives here:

* [Exported Surface Inventory `0.5.0`](./exported-surface-inventory-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)
* [Default-Behavior Compatibility Inventory `0.5.0`](./default-behavior-compatibility-inventory-0.5.0.md)
* [Decision Record: Default Behavior `0.5.0`](./decision-record-default-behavior-0.5.0.md)
* [Domain-Semantic Design Notes `0.5.0`](./domain-semantic-design-notes-0.5.0.md)
* [Decision Record: Core Boundaries `0.5.0`](./decision-record-core-boundaries-0.5.0.md)
* [Migration Notes `0.5.0`](./migration-notes-0.5.0.md)
* [Milestone Summary `0.5.0`](./release-prep-0.5.0.md)

The current draft extension-hook interfaces live in the public type surface as:

* `CausalContradictionPolicy`
* `ForkResolutionPolicy`
* `SemanticDedupePolicy`

## Domain-Semantic Design Rule

The payload-agnostic core stays honest about what it can know.

That means `0.5.0` avoids implementing domain-semantic behavior by accident through:

* anomaly wording that quietly implies a stronger semantic claim than the runtime can justify
* merge-like duplicate handling that hides operator-visible history
* fork detection that assumes a logical entity identity model the package has not actually defined
* contradiction handling that hardcodes one domain policy as if it were universal

When the repo considers one of those behaviors before `1.0.0`, it first states whether the behavior is:

* core
* pluggable
* intentionally unsupported

## Architectural Guardrails

The published `0.5.0` line and the active `0.6.x` line both actively defend the payload-agnostic boundary instead of only describing it.

That means:

* contradiction handling and entity-fork handling must not quietly become field-level domain merge logic in the core runtime
* the core package may detect breaks in causal integrity, but domain resolution must stay in user-supplied policy or extension layers
* semantic dedupe across different IDs must preserve full operator visibility:
  * no silent discard
  * no silent merge
  * no silent heavy mutation that disappears from result telemetry
* if a policy suppresses, rewrites, or collapses records, that action stays visible through anomalies, result telemetry, or similarly explicit audit-facing output

For the published `0.5.0` API-clarity work, the migration strategy stays non-breaking where possible:

* prefer JSDoc-driven deprecation for legacy public helpers before removing them
* do not silently delete `compareClocks()` or `compareWithTieBreaker()` in the first stability-candidate pass
* do not strip `orderValidatedEvents()` support paths before the narrower replacement contract is designed and documented

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

## Released `0.5.0` Posture

At the released stopping point, the repo can say:

* which exported names and result types it expects to preserve into `1.0.0`
* which remaining semantic areas are still open and why
* which domain-semantic behaviors belong outside the `1.0.0` core claim surface unless a later chunk designs them explicitly

That is the real outcome of `0.5.0`.
It reduces semantic surprise, not just advances the version story.
