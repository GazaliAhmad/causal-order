# `0.5.0` Decision Record: Default Behavior

This note turns the default-behavior compatibility inventory into explicit `0.5.0` default-position decisions.

It does not implement runtime changes by itself.
It records which current defaults the project expects to preserve, which still need narrower wording, and which remain review surface before `1.0.0`.

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Default-Behavior Compatibility Inventory `0.5.0`](./default-behavior-compatibility-inventory-0.5.0.md)

## Scope

This decision record covers the highest-priority default-behavior review items from the current `0.5.0` inventory:

* `strict`
* `allowUnknownOrder`
* `detectAnomalies`
* translation optional-field failure defaults

It also records the operator-visibility posture those defaults are expected to preserve.

## Decision 1: `strict`

Decision:

* preserve `strict: false` as the default
* preserve `strict` as the main fail-fast switch for ordering and validation layers
* do not pretend `strict` unifies every fail-fast surface in the package, especially translation policy

Why:

* warning-first bounded analysis remains the stronger default for audit, replay, debugging, and recovery workflows
* callers can already opt into fail-fast behavior explicitly where governance or ingestion enforcement requires it
* the main problem is wording ambiguity, not default direction

Compatibility posture:

* `strict: false` should be treated as preserve-by-default
* docs should explain more explicitly that translation uses dedicated policy configuration instead of the same `strict` option
* later `0.5.x` work may refine wording, but should not silently flip the default

Proposed migration wording:

`strict` remains the main fail-fast switch for ordering and validation paths.
The default stays `false`.
Translation fail-fast behavior continues to be controlled separately through `translateBatch()` policy rather than through the same `strict` option.

## Decision 2: `allowUnknownOrder`

Decision:

* preserve the current non-strict posture where unresolved ordering remains visible rather than rejected by default
* treat `allowUnknownOrder` as a review-and-wording surface, not as a behavior that should be removed impulsively

Why:

* the current package philosophy is to expose uncertainty honestly rather than flatten it away
* unresolved ordering should remain explicit by default in non-strict mode
* the bigger issue is making the interaction with `strict` easier to understand

Compatibility posture:

* the current unresolved-output behavior should be preserved
* `allowUnknownOrder === false` should continue to strengthen severity posture without becoming a hidden silent-rewrite switch
* `0.5.0` should improve wording before considering any rename

Proposed migration wording:

In non-strict mode, unresolved ordering remains explicit rather than being silently normalized away.
`allowUnknownOrder` should be read as an output-governance control layered on top of the current non-strict uncertainty model, not as permission for the library to invent stronger certainty.

## Decision 3: `detectAnomalies`

Decision:

* preserve `detectAnomalies: true` as the default
* preserve anomaly visibility as a default honesty feature rather than an advanced opt-in
* treat `detectAnomalies: false` as an output-shaping choice, not as a correctness mode

Why:

* anomaly visibility is part of the package’s core value proposition
* default-off anomaly reporting would cut directly against the project’s “no false certainty” posture
* the current ambiguity is mostly naming and documentation, not behavioral direction

Compatibility posture:

* default-on anomaly detection should be treated as preserve-by-default
* docs should say more explicitly that disabling anomaly detection reduces emitted analysis output rather than making ordering “stricter” or “cleaner”
* later API review can still revisit naming, but should preserve the visibility-first posture unless there is a major reason not to

Proposed migration wording:

`detectAnomalies` remains enabled by default because anomaly visibility is part of the ordinary package contract, not only a debugging extra.
Turning it off should be treated as reducing emitted diagnostic output, not as enabling a truer or stricter ordering mode.

## Decision 4: Translation Optional-Field Failure Defaults

Decision:

* preserve `optionalFieldFailure: "warn"` as the default translation posture
* preserve explicit opt-in escalation through `"continue"` and `"fail"`
* keep this area under compatibility review for wording clarity, but not as an unstable free-for-all

Why:

* warning-first optional-field handling matches the package’s current structured-visibility posture
* `"continue"` and `"fail"` already provide explicit caller-controlled escalation paths
* changing the default now would create unnecessary ingress churn without stronger evidence

Compatibility posture:

* `optionalFieldFailure: "warn"` should be treated as the intended current default
* `0.5.0` should clarify what counts as omission-safe `"continue"` behavior versus warning-visible rejection
* later changes should go through explicit migration wording rather than silent contract drift

Proposed migration wording:

The default translation posture for optional-field failures remains warning-visible rather than silent omission or fail-fast rejection.
Callers who want omission-tolerant behavior should choose `"continue"` explicitly.
Callers who want fail-fast ingress enforcement should choose `"fail"` explicitly.

## Operator-Visibility Decision

Decision:

* preserve operator visibility as a hard compatibility direction across all of the above defaults

That means the package should continue to prefer:

* explicit anomaly emission over silent suppression
* explicit unresolved output over fake certainty
* explicit warning-visible translation anomalies over silent cleanup

This is not only a docs preference.
It is a contract-design decision that later extension hooks must not weaken.

## Immediate `0.5.0` Follow-Through

These decisions imply the next practical steps:

1. tighten README and API-reference wording around `strict`, `allowUnknownOrder`, and `detectAnomalies`
2. clarify translation optional-field policy wording in the ingress-facing docs
3. keep later changes non-breaking unless the repo first adds explicit migration notes
4. carry the same operator-visibility rule into contradiction, fork, and semantic-dedupe policy design

## Non-Goals

This note does not yet decide:

* whether any of these option names should be renamed before `1.0.0`
* exact deprecation mechanics for any future option rename
* exact new telemetry fields for future extension-policy actions

Those remain later `0.5.x` work.
