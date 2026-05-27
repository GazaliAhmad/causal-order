# `0.5.0` Decision Record: Core Boundaries

This note turns the domain-semantic design guidance into explicit released `0.5.0` contract-boundary decisions.

It answers the main chunk-4 question directly:

* what belongs in the payload-agnostic core
* what belongs in extension hooks or policy surface
* what remains out of scope for the `1.0.0` core claim surface

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Decision Record: Default Behavior `0.5.0`](./decision-record-default-behavior-0.5.0.md)
* [Domain-Semantic Design Notes `0.5.0`](./domain-semantic-design-notes-0.5.0.md)

## Scope

This decision record covers the three highest-priority domain-semantic areas already identified in the `0.5.0` line:

* contradictory events
* entity forks
* semantic dedupe across different identifiers

It also records the broader line between:

* payload-agnostic detection
* policy-owned resolution
* intentionally unsupported core behavior

## Decision 1: Contradictory Events

Core:

* the core runtime may detect and emit contradiction-facing anomalies
* the core runtime may expose contradiction candidates to policy hooks in a payload-agnostic form
* the core runtime may preserve contradiction visibility in `OrderResult`, anomaly output, or equivalent telemetry

Extension hook:

* contradiction resolution belongs in `CausalContradictionPolicy` or a later equivalent policy surface
* any decision to suppress, retain, escalate, or quarantine contradictory records belongs outside the core runtime

Out of scope for the `1.0.0` core claim surface:

* last-write-wins as a built-in default contradiction rule
* payload-aware field merging
* automatic canonical-record choice by payload inspection
* hidden contradiction cleanup that makes the conflict disappear from operator view

Compatibility direction:

* contradiction handling is treated as detect-and-report in core
* contradiction resolution is treated as policy-owned

## Decision 2: Entity Forks

Core:

* the core runtime may cooperate with a caller-supplied logical identity grouping hook
* the core runtime may detect when a grouped identity stream splits concurrently
* the core runtime may expose fork candidates, fork anomalies, or equivalent audit-facing output in a payload-agnostic form

Extension hook:

* branch selection belongs in `ForkResolutionPolicy` or a later equivalent policy surface
* any decision about canonical lineage, human review, branch joining, or tolerated multi-branch business behavior belongs outside the core runtime

Out of scope for the `1.0.0` core claim surface:

* inferring logical entity identity from arbitrary payload fields by default
* choosing a winning branch inside the core runtime
* payload-aware branch merging
* claiming resolved entity truth without explicit higher-layer policy

Compatibility direction:

* fork detection is acceptable core territory only if it stays identity-hook driven and payload-agnostic
* fork resolution remains policy-owned

## Decision 3: Semantic Dedupe Across Different Identifiers

Core:

* the core runtime may surface semantic-dedupe candidates when the equivalence basis is caller-supplied or policy-supplied
* the core runtime may record participating event IDs, candidate evidence, and retained-versus-suppressed visibility records
* the core runtime must preserve operator visibility when policy later acts on dedupe candidates

Extension hook:

* any decision to suppress, collapse, rewrite, or prioritize one delivery over another belongs in `SemanticDedupePolicy` or a later equivalent policy surface

Out of scope for the `1.0.0` core claim surface:

* silent duplicate cleanup
* hidden record collapse that removes audit visibility
* default payload-aware dedupe inference inside the core runtime
* merge-like semantics that rewrite history without explicit policy-owned reporting

Compatibility direction:

* visibility-preserving candidate reporting is acceptable core territory
* action on those candidates remains policy-owned

## Cross-Cutting Boundary Decision

The package preserves this general split:

* core owns payload-agnostic detection
* extension hooks own domain-semantic resolution
* operator visibility must survive both

That means the core package may become better at:

* detecting integrity breaks
* surfacing machine-readable candidates
* preserving audit-facing telemetry

But the core package does not become responsible for:

* domain-object truth reconciliation
* payload-aware conflict merges
* hidden branch selection
* silent semantic cleanup

## `1.0.0` Claim-Surface Decision

The released boundary direction allows the eventual `1.0.0` core claim surface to say:

* this package detects and reports causal and integrity problems honestly
* this package supports payload-agnostic policy interaction points
* this package preserves operator visibility when uncertain or conflicting data appears

The core claim surface does not say, unless a later release explicitly redesigns the package around it:

* this package resolves domain contradictions automatically
* this package knows canonical entity truth
* this package deduplicates business objects correctly by itself

## Released `0.5.0` Follow-Through

These decisions shaped the released follow-through:

1. targeted public-surface tests landed around preserved visibility and non-silent-behavior guarantees
2. migration notes landed for preserved defaults and preferred helper names
3. future contradiction, fork, and dedupe implementation work remains behind explicit policy-owned contracts

## Non-Goals

This note does not yet decide:

* final runtime anomaly type names for contradiction or fork detection
* final telemetry field names for future policy actions
* whether all current draft policy interfaces are the final `1.0.0` names

Those remain later `0.6.x` and pre-`1.0.0` work.
