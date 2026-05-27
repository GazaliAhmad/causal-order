# `0.5.0` Default-Behavior Compatibility Inventory

This note records the released `0.5.0` default-behavior inventory after the exported-surface audit.

Its job is to inventory the current runtime defaults and behavioral assumptions that callers may already be depending on, then separate:

* defaults that look preserve-worthy
* defaults that need explicit `0.5.0` keep-or-change decisions
* defaults that need migration wording even if behavior does not change

Related notes:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Exported Surface Inventory `0.5.0`](./exported-surface-inventory-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)

## Scope

This inventory covers the current default behavior in:

* bounded ordering through `orderEvents()`
* validated ordering through `orderValidatedEvents()`
* streaming ordering through `orderEventStream()`
* raw-record ingress through `translateBatch()`
* deterministic fallback helpers and tie-breaker behavior

It also records operator-visibility expectations that later extension policies must not weaken.

## Released Preserve-By-Default Defaults

These defaults are strong enough that the published `0.5.0` line treats them as preserve-by-default unless a sharper compatibility reason appears in a later release.

### Bounded Ordering Defaults

* `strict` defaults to `false`
* `detectAnomalies` defaults to `true`
* `DEFAULT_TIE_BREAKER` is `"event_id"`
* `getTieBreaker()` falls back to `DEFAULT_TIE_BREAKER`

Why these look preserve-worthy:

* `strict: false` matches the library's current audit-and-recovery posture for bounded datasets
* anomaly visibility being default-on is aligned with the package honesty model
* `"event_id"` is a deterministic low-surprise fallback that does not pretend to know domain semantics

### Streaming Defaults

* `batchSize` defaults to `100`
* `maxLateArrivalMs` defaults to `30_000n`
* `lateArrivalPolicy` defaults to `"flag"`
* `watermark` defaults to `eventTimeWatermark`

Why these look preserve-worthy:

* `"flag"` keeps late arrivals visible without forcing correction-heavy behavior by default
* `eventTimeWatermark` is the least surprising payload-agnostic stream-progress baseline
* the current buffer and lateness defaults are operationally plausible without overclaiming finality

### Translation Defaults

* `policy.recordFailure` defaults to `"warn"`
* `policy.optionalFieldFailure` defaults to `"warn"`
* omitted logical counter resolves to `0`
* translated envelope shells are shallowly frozen while payloads remain by reference

Why these look preserve-worthy:

* warning-first translation defaults match the package's current non-silent, non-fail-fast onboarding posture
* `logicalCounter: 0` is consistent with the current ingress contract for records that only supply physical time
* the immutability split is already documented and tested as intentional contract shape

## Explicitly Documented Review Defaults

These behaviors are coherent today, and `0.5.0` documents them explicitly rather than letting them stay implicit.

### `allowUnknownOrder`

Current behavior:

* unresolved ordering still surfaces as `unknown_order`
* severity becomes `"error"` only when `allowUnknownOrder === false`
* otherwise unresolved ordering is tolerated with warning-level visibility in non-strict mode

Why this is documented explicitly:

* it is easy to misread `allowUnknownOrder` as broader than severity shaping
* the interaction with `strict` is not instantly obvious to first-time users

### `detectAnomalies: false`

Current behavior:

* validation failures still surface as `invalid_clock` anomalies when anomaly collection is disabled
* cross-record anomaly collection is otherwise reduced

Why this needs review:

* the current behavior is reasonable, but the option name can be read as stronger than it really is
* `0.5.0` records this as an output-shaping rule that remains explicit rather than silently assumed

### Translation Optional-Field Escalation

Current behavior:

* default optional-field failures warn
* `"continue"` allows omission for specific optional-field failures
* `"fail"` turns structured anomalies into thrown `TranslateBatchPolicyError`

Why this is documented explicitly:

* the structure is good, but callers may rely on the exact warn-versus-continue distinction
* `0.5.0` records which parts are preserve-worthy contract and which parts remain intentionally explicit design surface

### Streaming Correction Reach

Current behavior:

* `lateArrivalPolicy: "emit_correction"` produces correction-capable follow-up batches
* correction scope is currently `"all_non_final_output"`

Why this is documented explicitly:

* the current wording is intentionally honest but operationally broad
* `0.5.0` keeps that exact scope wording explicit rather than implying stronger finality than the runtime can justify

## Migration-Wording Candidates

These behaviors stay unchanged while still needing clearer public wording.

### `strict`

Current behavior spans several layers:

* invalid event validation throws in batch mode
* invalid stream events throw in stream mode
* unresolved ordering throws in strict bounded ordering
* translation fail-fast uses explicit policy rather than the same `strict` flag

The compatibility question is not only whether `strict` stays.
It is whether the docs clearly state what strictness does and does not unify across package layers.

### Streaming Watermark Semantics

Current behavior is:

* watermark is an operational readiness signal
* readiness uses `eventTime <= watermark`
* lateness uses `eventTime < watermark`

That behavior looks intentional and should likely stay.
What still needs wording is that this is operational, not causal truth.

### Translation Warning-First Posture

Current behavior is already documented in pieces, and `0.5.0` states the compatibility expectation more plainly:

* translation defaults favor structured warning visibility over silent coercion
* fail-fast behavior is explicit opt-in through policy

## Operator-Visibility Guarantees

These are the most important behavioral guarantees to preserve as later extension hooks arrive.

### Current Runtime Guarantees

The current package already leans in the right direction:

* `orderEvents()` keeps anomaly collection on by default
* `orderEventStream()` defaults late arrivals to `"flag"` rather than silent suppression
* translation failures split accepted envelopes from structured anomalies instead of hiding bad records

`0.5.0` treats that visibility posture as a preserve-worthy compatibility direction.

### Future Extension-Policy Guarantee

The draft extension interfaces in `src/types.ts` should be read with one hard rule:

* no contradiction, fork, or semantic-dedupe policy may silently erase operator visibility

That means future policy decisions should remain visible through audit-facing output such as:

* anomalies
* policy visibility records
* retained-versus-suppressed identifiers
* explicit resolution or deferral results

This is especially important for semantic dedupe across different IDs.
If the library ever permits policy-driven suppression, that suppression must remain visible rather than becoming invisible history rewriting.

## Current Default Matrix

| Area | Current Default | Compatibility Posture |
| --- | --- | --- |
| `orderEvents().strict` | `false` | preserve-by-default candidate |
| `orderEvents().detectAnomalies` | `true` | preserve-by-default candidate |
| `orderEvents().allowUnknownOrder` | warning-level unresolved output unless explicitly `false` | explicit review |
| tie-breaker fallback | `"event_id"` | preserve-by-default candidate |
| `orderEventStream().batchSize` | `100` | preserve-by-default candidate |
| `orderEventStream().maxLateArrivalMs` | `30_000n` | preserve-by-default candidate |
| `orderEventStream().lateArrivalPolicy` | `"flag"` | preserve-by-default candidate |
| `orderEventStream().watermark` | `eventTimeWatermark` | preserve-by-default candidate |
| `translateBatch().policy.recordFailure` | `"warn"` | preserve-by-default candidate |
| `translateBatch().policy.optionalFieldFailure` | `"warn"` | explicit review |
| translated logical counter fallback | `0` | preserve-by-default candidate |
| anomaly/operator visibility | on and explicit by default | preserve-by-default direction |

## Released Outcome

This chunk now lands with the paired default-behavior decision record and release wording:

1. compatibility wording exists for `strict`, `allowUnknownOrder`, and `detectAnomalies`
2. the translation optional-field default posture is preserved and documented
3. the current stream correction-scope wording remains explicit release surface rather than silent assumption
4. operator-visibility preservation is a hard requirement for all later extension-policy work

## Good Stopping Point For This Chunk

This chunk is in a good place when the repo can say:

* which defaults are stable enough to preserve
* which defaults still need explicit review
* which behaviors need clearer migration wording even without runtime changes
* which visibility guarantees later extension hooks must not weaken
