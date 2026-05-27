# `0.5.0` Domain-Semantic Design Notes

This note records the `0.5.0` boundary design for the three domain-semantic areas that the payload-agnostic core does not fully solve on its own:

* contradiction handling
* entity forks
* semantic deduplication across different identifiers

It is intentionally a design note, not an implementation note.
Its purpose is to keep these concepts from polluting the core engine on the path to `1.0.0`.

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Default-Behavior Compatibility Inventory `0.5.0`](./default-behavior-compatibility-inventory-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)
* [Decision Record: Core Boundaries `0.5.0`](./decision-record-core-boundaries-0.5.0.md)

## Working Rule

The payload-agnostic core may detect breaks in causal integrity.
It must not pretend to know domain-specific resolution rules for foreign payloads.

That means this note draws a hard split between:

* core detection and audit visibility
* higher-layer grouping and resolution policy

## 1. Causal Contradiction Handling

### Core Responsibility

The core engine only detects and flags a contradiction.

Examples include:

* two distinct events from the same node with identical HLC values but materially different content
* explicit causal claims that cannot be reconciled with the current causal evidence model
* payload-agnostic integrity breaks that indicate the event history is not internally trustworthy on its own terms

The important point is that the core is not being asked to "fix" the contradiction.
It is being asked to make the contradiction explicit and machine-visible.

### Recommended Core Output

The released design direction is an explicit contradiction-facing anomaly shape, such as:

* `ContradictoryEventAnomaly`

That anomaly is designed as:

* payload-agnostic
* machine-readable
* audit-visible
* compatible with later policy hooks

The core output for this area exposes:

* the implicated event IDs
* the implicated node or causal evidence where applicable
* the reason the contradiction was flagged
* enough visibility for a policy layer to decide what to do next

### Policy Boundary

The core must not attempt contradiction resolution through internal rules such as:

* last-write-wins
* deep-merging fields
* picking a canonical event by payload inspection
* auto-rewriting one contradictory record into another

Those decisions depend on domain meaning that the core package does not own.

The contradiction should therefore be:

* detected by the core
* surfaced by anomaly/result telemetry
* passed to an external policy hook for any actual resolution decision

## 2. Entity Fork Identification

### Core Responsibility

The core engine only understands causal streams and event relationships.
It does not natively understand application-level entity identity.

So the core responsibility here is limited to two things:

* provide an abstract grouping hook for a logical entity tracking ID
* detect when a grouped identity stream splits concurrently

In practical terms, that means the core may help identify a fork shape such as:

* `A -> B`
* `A -> C`
* no clean join yet between `B` and `C`

What matters is the split in causal history, not payload-level business reconciliation.

### Core Detection Boundary

The core may:

* accept or cooperate with a caller-supplied logical identity grouping model
* detect that multiple concurrent descendants now represent a forked identity history
* surface that fork state in a payload-agnostic result form

The core must not:

* infer entity identity from arbitrary payload fields by default
* decide which branch is canonical
* merge fork branches by payload inspection
* claim a resolved entity truth without an external domain policy

### Policy Boundary

Resolving which fork line is canonical belongs entirely to higher-layer application logic.

That includes decisions such as:

* whether one branch wins
* whether both branches stay visible pending human review
* whether a later domain event joins the branches
* whether the fork is acceptable business behavior or integrity failure

The core only exposes the fork clearly enough that a higher layer can make that decision honestly.

## 3. Semantic Deduplication Across Varied Identifiers

### Core Responsibility

The core may track and flag duplicate deliveries of conceptually identical payloads even when transport metadata or synthetic IDs differ.

That means this layer can be responsible for:

* surfacing a semantic-dedupe candidate
* preserving the relevant event IDs and evidence
* exposing the candidate inside result telemetry

This is still payload-agnostic contract work only if the dedupe candidate is based on caller-supplied or policy-supplied equivalence evidence rather than hidden domain inference inside the core runtime.

### Required Visibility Rule

The engine must expose these duplicates inside the `OrderResult` and related telemetry rather than silently purging them.

That means:

* no silent suppression
* no silent purge from the history the operator sees
* no mutation that hides which records were retained, suppressed, or deferred

The minimum visibility posture should include:

* the participating event IDs
* the evidence or policy basis for the semantic-dedupe candidate
* retained-versus-suppressed reporting where a later policy chooses suppression
* anomaly or telemetry output that keeps the audit trail intact

### Policy Boundary

The core must not treat semantic dedupe as silent cleanup.

Any operational action beyond flagging, such as:

* suppressing secondary deliveries
* preferring one synthetic ID over another
* collapsing multiple deliveries into one downstream interpretation

belongs to a higher-layer policy or state machine.

The core may help detect and report.
It must not silently rewrite history.

## Cross-Cutting Output Rules

These three areas share the same architectural boundary:

* detection in core
* resolution in policy
* visibility preserved for operators

So any future implementation should preserve these rules:

* no payload-aware merge semantics in the core runtime
* no canonical-branch selection in the core runtime
* no silent dedupe cleanup in the core runtime
* no policy action that becomes invisible to `OrderResult`-level telemetry

## Relationship To Draft Interfaces

The current draft interfaces in `src/types.ts` are the intended extension boundary for this design direction:

* `CausalContradictionPolicy`
* `ForkResolutionPolicy`
* `SemanticDedupePolicy`
* `PolicyVisibilityRecord`

Those types exist to prove that the core engine can interact with future policies without caring about the underlying event payload shape.

## Released `0.5.0` Posture

This design note is doing its job when the repo can say:

* what the core may detect
* what the core must not resolve
* what higher-layer policy must own
* what visibility guarantees later implementations are not allowed to weaken
