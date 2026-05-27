# `0.5.0` Exported Surface Inventory

This note is the first concrete audit artifact for the `0.5.0` stability-candidate line.

It is not a release note.
It is a working inventory of the public package surface that `1.0.0` may need to preserve, rename, narrow, or document more explicitly.

For the milestone frame, see:

* [Implementation Guide `0.5.0`](./implementation-guide-0.5.0.md)
* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)
* [ROADMAP `0.5.x`](../../ROADMAP.md)

## Audit Scope

This inventory covers the currently published public surface exposed through:

* `causal-order`
* `causal-order/types`
* `causal-order/clock`
* `causal-order/compare`
* `causal-order/validate`
* `causal-order/anomalies`
* `causal-order/order`
* `causal-order/batch`
* `causal-order/stream`
* `causal-order/watermarks`
* `causal-order/translate`

The goal here is not to rewrite the API in one pass.
The goal is to separate:

* names and shapes that already feel preserve-worthy
* names and shapes that need explicit `0.5.0` keep-or-rename decisions
* public signatures that expose implementation detail too directly

## Current Entrypoints

The current entrypoint split is coherent enough to keep as a baseline:

* `causal-order`: full top-level surface
* `causal-order/translate`: raw-record ingress
* `causal-order/batch`: bounded ordering
* `causal-order/stream`: async stream ordering
* `causal-order/watermarks`: watermark helpers
* `causal-order/order`: combined ordering barrel
* `causal-order/clock`, `compare`, `validate`, `anomalies`, `types`: focused supporting surfaces

This split already matches the mental model well enough that `0.5.0` does not need to redesign entrypoints first.
The more important work is deciding whether the names inside those entrypoints are stable enough to preserve.

## Surface Map

The main public functions and classes currently exposed are:

* clocks:
  * `createHlcClock()`
  * `parseHlc()`
  * `serializeHlc()`
* pairwise comparison:
  * `compareByHlc()`
  * `compareClocks()`
  * `compareByCausality()`
  * `compareValidatedByCausality()`
  * `applyTieBreaker()`
  * `compareDeterministically()`
  * `compareValidatedDeterministically()`
* validation:
  * `validateClock()`
  * `validateEvent()`
* anomaly detection:
  * `detectAnomalies()`
  * `detectSingleEventAnomalies()`
* ordering:
  * `DEFAULT_TIE_BREAKER`
  * `getTieBreaker()`
  * `compareWithTieBreaker()`
  * `orderEvents()`
  * `orderValidatedEvents()`
  * `orderEventStream()`
* watermark helpers:
  * `eventTimeWatermark()`
  * `ingestedAtWatermark()`
  * `createProcessingTimeWatermark()`
* translation:
  * `translateBatch()`
  * `TranslateBatchPolicyError`

The exported type surface is broader, especially in `causal-order/types`, and falls into six practical groups:

* core event and clock types
* translation and translation-diagnostic types
* validation and anomaly types
* bounded ordering result types
* streaming result types
* watermark and policy types

## Feels Stable Enough To Preserve

These names look strong enough that `0.5.0` should treat them as preserve-by-default unless a sharper problem appears:

* `createHlcClock`
* `parseHlc`
* `serializeHlc`
* `compareByCausality`
* `validateClock`
* `validateEvent`
* `detectAnomalies`
* `detectSingleEventAnomalies`
* `orderEvents`
* `orderEventStream`
* `translateBatch`
* `EventEnvelope`
* `ValidatedEventEnvelope`
* `TranslatedEventEnvelope`
* `OrderResult`
* `OrderedEvent`
* `EventAnomaly`
* `LateArrivalPolicy`
* `WatermarkFunction`
* `TranslateBatchResult`
* `TranslationAnomaly`
* `TranslationDiagnostic`

These names are not perfect because they are short.
They are strong because they map cleanly to the package mental model and already have real docs and examples behind them.

## Keep-Or-Rename Review Candidates

These names feel soft enough that `0.5.0` should make an explicit keep-or-rename decision.

### Pairwise HLC Comparison Overlap

The current surface has both:

* `compareByHlc()`
* `compareClocks()`

Today they are effectively name variants around the same basic concept.
That creates avoidable ambiguity:

* `compareByHlc` is explicit about mechanism
* `compareClocks` is shorter, but less specific and easier to read as a broader semantic promise

`0.5.0` should decide whether both names are preserved intentionally, or whether one is the long-term public name and the other should become compatibility-only or be removed before `1.0.0`.

### Deterministic Comparison Overlap

The deterministic fallback surface currently has three closely related names:

* `applyTieBreaker()`
* `compareDeterministically()`
* `compareWithTieBreaker()`

This is the clearest naming-overlap area in the public runtime today.

The names are individually understandable, but together they raise obvious questions:

* which one is the intended user-facing helper?
* which one is mainly a lower-level building block?
* is `compareWithTieBreaker()` a domain-level comparison or just a convenience wrapper?
* does `applyTieBreaker()` sound more internal than public?

`0.5.0` should likely reduce this to one obviously primary public name plus clearly secondary compatibility surface if needed.

### `orderValidatedEvents()`

`orderValidatedEvents()` is useful and conceptually valid as a public helper.
The current signature is the softer part, not the idea:

* it exposes an `internal` parameter shape
* that `internal` shape includes `sourceEvents`, `validations`, `anomalies`, and `invalidEvents`

That reads more like implementation plumbing than a long-term public contract.

`0.5.0` should decide one of these explicitly:

* preserve `orderValidatedEvents()` but narrow the public signature
* move the current extended form behind an internal-only path
* keep the current shape intentionally and document why that plumbing is part of the contract

The default assumption should be that `internal` is too implementation-revealing for `1.0.0`.

### `OrderBatch`

`OrderBatch` works, but it is more generic than the rest of the stream surface.
Because it is emitted by `orderEventStream()`, the current name invites a small ambiguity:

* is this a stream-emission type?
* or a general batch-ordering result type?

The actual type includes streaming-only concepts such as:

* `watermark`
* `anomalyHorizon`
* `correction`
* `isFinal`

That means `0.5.0` should decide whether `OrderBatch` is good enough to preserve or whether a more stream-specific name would be clearer before `1.0.0`.

### `strict`

`strict` is short and heavily used in the docs, but it still deserves a keep-or-rename decision because it covers different failure shapes:

* invalid input validation
* unresolved ordering
* stream policy rejection

The behavior can stay the same and still deserve clearer compatibility wording.
`0.5.0` does not necessarily need to rename `strict`, but it should decide whether the single name is precise enough to preserve across batch, stream, and translation-adjacent mental models.

### `detectAnomalies`

`detectAnomalies` as an `OrderOptions` flag is readable, but the naming question is whether it sounds optional in a way that understates the semantic importance of anomaly visibility.

`0.5.0` should decide whether:

* the current default-on behavior is long-term
* the option name stays as-is
* the docs need to frame it more clearly as an output-shaping toggle rather than a correctness toggle

### `allowUnknownOrder`

`allowUnknownOrder` is understandable once you know the model.
It still deserves review because it sits close to `strict`, and the two together are not instantly self-explanatory to a first-time user.

This may remain unchanged.
But `0.5.0` should decide whether the current pairing is precise enough to preserve long-term.

## Broad Type-Surface Notes

### Translation Types

The translation type surface is broad but relatively coherent.
The strongest preservation candidates are:

* `TranslateBatchConfig`
* `TranslateBatchPolicy`
* `TranslateBatchResult`
* `TranslationAnomaly`
* `TranslationDiagnostic`
* `TranslationAnomalyClassification`

The softer area is not the existence of those types.
It is how much of the very detailed nested diagnostic vocabulary should be treated as frozen contract versus still-refinable pre-`1.0.0` structure.

`0.5.0` should make that compatibility stance explicit.

### Ordering And Confidence Types

The current bounded-ordering result model is strong:

* `OrderResult`
* `OrderedEvent`
* `OrderStats`
* `CausalEvidence`
* confidence values:
  * `proven`
  * `derived`
  * `fallback`
  * `unknown`

The main `0.5.0` question here is not naming polish.
It is whether these semantics are now stable enough to preserve without major re-interpretation.

### Streaming Types

The streaming surface feels honest, but some of its types are really policy-contract types more than abstract domain nouns:

* `CorrectionNotice`
* `StreamAnomalyHorizon`
* `LateArrivalPolicy`
* `OrderBatch`

These should stay together as a reviewed cluster during `0.5.0`.
The key question is not whether they exist.
It is whether their wording and scope are precise enough for long-term preservation.

## Explicit Review List For `0.5.0`

The first chunk should therefore treat these as named review items:

* `compareByHlc` versus `compareClocks`
* `applyTieBreaker` versus `compareDeterministically` versus `compareWithTieBreaker`
* `orderValidatedEvents` public signature, especially the `internal` parameter
* `OrderBatch` naming
* `strict` compatibility wording
* `detectAnomalies` default behavior and naming posture
* `allowUnknownOrder` wording relative to `strict`

## Recommended Starting Decisions

If `0.5.0` wants a narrow first pass, the most urgent likely decisions are:

1. decide whether `compareClocks()` and `compareByHlc()` both survive
2. decide whether `orderValidatedEvents()` keeps a public `internal` parameter
3. pick one clearly primary deterministic-comparison helper name

Those three decisions would remove more ambiguity than a broad naming sweep across every exported type.

## Initial Recommendation Table

These are the current recommended `0.5.0` decisions for the first three review items.

| Item | Recommendation | Why |
| --- | --- | --- |
| `compareByHlc()` versus `compareClocks()` | keep `compareByHlc()` as the primary long-term name; deprecate or compatibility-retain `compareClocks()` | `compareByHlc()` is more explicit about mechanism, while `compareClocks()` is broader-sounding without adding distinct behavior |
| `applyTieBreaker()` versus `compareDeterministically()` versus `compareWithTieBreaker()` | keep `compareDeterministically()` as the primary user-facing helper; treat `applyTieBreaker()` as lower-level and review whether `compareWithTieBreaker()` should survive as a separate public alias | the current trio overlaps heavily; one clearly primary deterministic helper would reduce confusion |
| `orderValidatedEvents()` public `internal` parameter | keep `orderValidatedEvents()` as a public concept, but narrow the public signature before `1.0.0` so `internal` plumbing is not part of the stable contract | the function is useful, but the `internal` bag exposes implementation detail more than domain contract |

In shorter form, the current recommendation is:

* `compareByHlc()`: keep
* `compareClocks()`: deprecate or compatibility-retain
* `compareDeterministically()`: keep as primary
* `applyTieBreaker()`: keep only if the lower-level role is intentional
* `compareWithTieBreaker()`: strong review candidate for deprecation or alias removal
* `orderValidatedEvents()`: keep the function, narrow the signature

These are still audit recommendations, not yet binding release decisions.
The point is to make the next `0.5.0` chunk argue from a concrete default position instead of reopening the same naming question from scratch.

Those recommendations are now carried forward in:

* [Decision Record: API Clarity `0.5.0`](./decision-record-api-clarity-0.5.0.md)

## Good Stopping Point For This Chunk

This first audit chunk is in a good place when the repo can say:

* which names are preserve-by-default
* which names require explicit keep-or-rename decisions before `1.0.0`
* which currently public signatures expose too much implementation detail

That would give the next `0.5.0` chunk a concrete compatibility inventory instead of a vague sense that the API should probably feel more stable.
