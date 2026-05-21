# `0.4.0` Implementation Guide

This note records the `0.4.0` work in the same scoped, commit-friendly style as the earlier `0.3.x` implementation guides.

The important sequencing for `0.4.0` is:

* define the ingress contract first
* prove the accepted input forms behave deterministically second
* lock ownership, anomaly, and immutability rules only after the public shape is clear

For the broader milestone intent, see:

* [ROADMAP `0.4.x`](../../ROADMAP.md)
* [Developer Experience `0.4.x`](./developer-experience-0.4.x.md)

## Working Rule

`0.4.0` should treat `translateBatch()` as a public ingress contract, not as a convenience helper.

That means the release is not only deciding whether translation is easier.
It is deciding what downstream users may rely on long term.

This work should stay split between a few clearly different kinds of contract decisions:

* public translation API shape
* temporal coercion rules
* mapping-anomaly shape
* mapper semantics
* ownership and immutability guarantees
* docs and release wording

The repo should avoid mixing those together casually.

If the branch changes coercion rules, anomaly reporting, ownership rules, and docs language all at once, it becomes much harder to tell whether the ingress contract actually got clearer or only got broader.

## Sub-Goal

`0.4.0` should define the first stable public boundary for moving arbitrary user-space records into the current core event contract without pulling evaluation tooling or environment glue into the package.

In practice, that means:

* do not start by adding file-format adapters
* do not start by adding CLI-facing convenience flows
* do not let async translation pressure expand the first ingress contract
* do start by making the ingress contract explicit, narrow, and deterministic

The most important questions at this stage are basic boundary questions:

* what raw shapes does the package officially accept?
* what raw temporal forms are accepted?
* how do invalid inputs fail?
* what anomaly taxonomy exists at translation time?
* what does the package preserve by reference?
* what does the package copy or freeze?
* what mapper behavior is contract and what is still intentionally unsupported?

This milestone is about defining a defensible protocol boundary, not about evaluation tooling or companion-repo convenience.

For `0.4.x`, that ingress boundary should stay synchronous.

Async translation, async iterables, stream translation, and backpressure-aware ingestion should all remain out of scope for this release line.
If those concerns matter later, they should arrive as deliberate post-`0.4.x` surface design rather than as incidental DX expansion.

## Chunk Order

The intended landing order is:

1. translation surface shape
2. field-by-field mapper contract
3. deterministic temporal coercion for accepted primitive timestamp inputs
4. structured mapping-anomaly output for invalid translation input
5. ownership, copying, and freezing guarantees for exposed translated envelopes
6. proof layer: tests, examples used as contract checks, and docs / release wording

The early chunks should answer the public-shape questions first:

* can user-space records feed the public contract without assertion-heavy `as any` glue?
* are mapper functions called under clear, testable rules?
* are accepted temporal forms normalized identically?
* do rejected temporal values fail deterministically?
* does the core package preserve opaque payloads without interpretation?
* can users tell what the package owns after translation and what it does not?

Only after that is stable should the repo make stronger wording claims around the ingress contract.

If `0.4.0` lands well, the result should feel smaller and more disciplined than a generic ingestion layer:

* a pure mapping surface
* deterministic coercion
* explicit failure shape
* explicit ownership rules
* no drift into file parsing or environment orchestration

The key is to keep the first published ingress contract narrower than the total long-term ambition.
It is safer to widen a contract later than to retract one that shipped with vague semantics.

The most important sequencing rule inside `0.4.0` is:

* do not finalize the proof layer before the mapper contract is fully spelled out

If tests land before the field-level mapper rules are explicit, the tests will quietly become the contract by accident.

## Translation Surface Shape

The first ingress contract should stay purely synchronous.

`translateBatch()` should accept:

* an array of raw user-space records
* a strongly typed config object containing mapper functions and baseline translation rules

The input surface should stay broad enough that users are not forced into assertion gymnastics before calling the package.

At the same time, the public signature should not collapse into `unknown[]` or `Record<string, any>[]` as the only visible contract.
The cleaner shape is a generic input boundary where the caller's record type flows into mapper functions without requiring `as any`.

In practical terms, `0.4.0` should aim for a shape closer to:

```ts
translateBatch<TInput, TPayload = unknown>(
  records: readonly TInput[],
  config: TranslateBatchConfig<TInput, TPayload>,
): TranslateBatchResult<TPayload>
```

The return value should split:

* successfully translated immutable envelopes
* structured translation anomalies

The important point is not the exact type name.
It is that the container is predictable, typed, and visibly separates accepted records from rejected ones.

## Field-By-Field Mapper Contract

Before `0.4.0` can treat `translateBatch()` as a real ingress contract, the mapper surface needs to be explicit at the field level rather than only at the milestone level.

At minimum, the repo should settle these rules before the proof layer:

### Required Fields

These should be treated as required translation inputs:

* event identity
* node identity
* physical event time

`0.4.0` should decide whether these are exposed with exact names such as:

* `getEventId`
* `getNodeId`
* `getPhysicalTime`

or with some equivalent naming scheme, but the required-versus-optional split should not stay ambiguous.

### Optional Fields

These should be treated as optional translation inputs unless the repo intentionally promotes one of them later:

* logical counter
* sequence
* parent event id
* dependency event ids
* trace id
* partition
* ingested-at time
* payload

Optional should mean:

* the mapper may be omitted entirely
* omitted optional mappers do not themselves produce anomalies
* if an optional mapper is provided, its returned value must still follow that field's value-shape rules

### Mapper Invocation Shape

Each mapper should be a synchronous function.

The default call shape should stay narrow and explicit:

```ts
(record, index) => value
```

`0.4.0` should avoid adding richer context objects, shared mutable translation state, or cross-field dependency hooks in the first ingress contract.

### Allowed Return Shapes

The repo should define what each mapper is allowed to return before tests are written as if the answer is already obvious.

The basic rule should be:

* required-field mappers may return any raw candidate value shape that the coercion layer explicitly supports for that field
* optional-field mappers may return either:
  * a supported raw candidate value
  * `undefined` to mean omitted

The docs should avoid leaving `null` ambiguous.
`0.4.0` should decide intentionally whether `null` means:

* invalid value
* omitted optional value
* or unsupported entirely

The safer first contract is to avoid giving `null` implicit omission semantics unless the repo has a strong reason to do so.

### Missing Versus Invalid

The mapper contract should keep these distinct:

* missing value
* invalid value

Examples:

* a required mapper returning `undefined` should not be treated the same as a malformed timestamp string
* an omitted optional mapper should not be treated the same as an optional mapper returning an invalid value

That distinction should show up in anomaly classification and in tests.

### Relationship Fields

`0.4.0` should define relationship-field shape explicitly.

For `parentEventId`:

* either omitted
* or one raw candidate value for one parent reference

For `dependencyEventIds`:

* either omitted
* or an array-like collection of raw candidate dependency ids

The first ingress contract should avoid clever convenience behavior such as:

* scalar-to-array coercion for dependency collections
* mixed scalar / array acceptance depending on call site
* hidden normalization that makes relationship shape broader than the docs claim

If readonly arrays are accepted, that should be explicit.
If only plain arrays are accepted, that should be explicit too.

### Mapper Exceptions

`0.4.0` should define mapper exception handling before tests and examples assume a behavior.

The core question is:

* if a mapper throws, is that always a structured anomaly, always a hard failure, or policy-controlled?

Whatever answer the repo chooses, it should be field-stable and testable.

The main point is to avoid letting raw thrown exceptions become the accidental public behavior of the ingress contract.

### Evaluation Order

The repo should also decide whether field mappers are:

* all evaluated independently for a record
* or short-circuited after the first unrecoverable failure

That decision affects:

* anomaly count
* anomaly determinism
* cost under bad input
* what users may rely on when mappers have side effects by mistake

The safest first contract is to tell users that mappers should be pure and side-effect free, then keep the actual evaluation strategy narrow and explicitly documented.

`0.4.0` should also keep one implementation reminder visible here:

* the mapper contract is clearer now at the milestone level, but it is not yet fully spelled out field-by-field

Before the ingress contract is considered truly settled in code, those field-level answers should be locked before tests and examples are treated as proof of the contract.

## PR Guardrails

Convenience pressure should not quietly widen the `0.4.0` translation surface through implementation-side helpers.

During `0.4.0`, PRs should reject additions such as:

* `fs.readFile()` helpers or filesystem-backed convenience wrappers whose main purpose is to feed arrays into `translateBatch()`
* stream-handling helpers that exist only to adapt file or transport input into the synchronous batch ingress contract
* `Promise.all`, `async` / `await`, or other async control flow inside the translation pipeline

If a proposed helper exists mainly to make `translateBatch()` feel more like file ingestion or streaming ingestion, it belongs outside the core `0.4.x` line.

## Public Contract Stability

`0.4.0` is the point where ingress-facing surface may become public, but that does not mean every new surface should be read as fully stable for the rest of pre-`1.0`.

The repo should be explicit about the current status of:

* `translateBatch()`
* mapper shape
* anomaly names
* policy keys
* timestamp coercion behavior

Within `0.4.x`, these should be treated as contract-design surface unless the docs explicitly elevate a specific behavior to stronger compatibility expectations.

The goal is to avoid accidental “soft stable” promises created only by exposure.
Public visibility and long-term stability should not be treated as the same thing before `1.0.0`.

## Required Coercion Matrix

Deterministic coercion should not stay at the level of a general promise.
`0.4.0` should define and test an explicit matrix for the temporal ingress boundary.

At minimum, the release should make an intentional decision for each of these:

* safe integer `number`
* `bigint`
* `Date`
* ISO timestamp string
* invalid string
* `NaN`
* `Infinity`
* fractional milliseconds
* negative epoch values
* unsafe integer values
* timezone edge cases

The point of the matrix is not that every form must be accepted.
The point is that each form must have a stable, tested answer:

* accepted and normalized
* rejected with structured anomaly output
* deferred explicitly to a later release

For the first ingress contract, both `Date` values and ISO timestamp strings should be rejected explicitly.

That rejection should be treated as part of the public `0.4.0` contract rather than as a temporary omission or an incidental implementation gap.

Numeric strings should be accepted only in canonical integer epoch-millisecond form.

That means the first ingress contract should reject broader numeric-string parsing behavior such as:

* decimal strings
* exponent notation
* separator syntax
* surrounding whitespace
* ISO fallback parsing
* other non-canonical numeric spellings

The goal is to keep string acceptance aligned with one narrow mathematical shape rather than quietly inheriting a wider parser surface.

The first ingress contract should enforce that with a strict integer-string grammar rather than broad numeric parsing.

In practical terms, `0.4.0` should prefer a pattern equivalent to:

```text
/^-?(0|[1-9]\d*)$/
```

That keeps the parser narrow by rejecting:

* decimal spellings
* exponent notation
* separator syntax
* surrounding whitespace
* leading `+`
* non-canonical leading-zero forms other than `"0"`

Negative epoch values should be accepted in the first ingress contract.

That means pre-`1970` timestamps remain valid when they are expressed as:

* negative `bigint`
* negative safe integer `number`
* negative canonical integer string

The contract should stay numerically consistent here rather than introducing an artificial post-`1970` cutoff into the ingress layer.

More generally, the first ingress contract should accept safe integer epoch-millisecond values regardless of sign.

That means:

* positive safe integer values are accepted
* zero is accepted
* negative safe integer values are accepted

The ingress contract should not impose a non-negative-only timestamp floor.

For primitive handling more broadly:

* safe integer `number` values should be accepted regardless of sign
* `number` values that are not safe integers should be rejected deterministically
* `bigint` values should be accepted as integer primitives rather than routed through lossy numeric conversion
* strings should normalize only if they match the canonical integer grammar exactly

`0.4.0` should not rely on incidental JavaScript parsing behavior for any of those cases.

Timezone edge cases matter even if ISO strings are initially rejected, because the repo should avoid accidentally drifting into partial date parsing semantics later.

This is one of the main places hidden ambiguity can survive under otherwise clean API language.

## Test Expectations

`0.4.0` should treat the coercion matrix as mandatory release coverage, not as optional follow-up.

The tests should prove at least:

* mathematically identical accepted forms normalize identically
* rejected forms fail deterministically with stable anomaly shape
* no partial acceptance happens by accident for borderline inputs
* the repo has an explicit answer for unsupported date-like inputs rather than relying on incidental runtime behavior
* `Date` and ISO timestamp string inputs are rejected intentionally rather than only because support has not been implemented yet
* numeric strings are accepted only in canonical integer epoch-millisecond form rather than through broad numeric parsing
* negative epoch values are accepted consistently across supported primitive input forms
* safe integer epoch-millisecond values are accepted regardless of sign rather than only when non-negative
* `bigint` handling preserves integer semantics directly instead of passing through broader JS numeric parsing paths

## Payload Preservation And Immutability

`0.4.0` should define a shallow, explicit ownership boundary rather than trying to deep-freeze the entire translated result.

The structural envelope should be treated as library-owned output:

* structural metadata should be copied into fresh objects
* dependency collections such as `dependencyEventIds` should be copied
* copied structural collections should be frozen
* the returned envelope object itself should be frozen

The business-domain payload should be treated differently:

* payload should be preserved by reference
* payload should not be traversed
* payload should not be cloned
* payload should not be frozen
* payload should not be interpreted by domain shape

This gives `0.4.0` a clearer split:

* structural shell: immutable, library-owned output
* payload: caller-owned reference passed through untouched

That split is easier to explain, easier to test, and less likely to create accidental deep-ownership promises than a blanket recursive freeze policy.

## Things To Avoid

Avoid combining these in one commit:

* translation-surface work plus file I/O adapters
* coercion rules plus CLI or terminal-evaluation work
* payload-preservation guarantees plus domain-specific parsing helpers
* immutability changes plus unrelated ordering-semantic edits
* mapper-semantics changes plus unrelated convenience helpers
* docs wording plus unverified coercion, anomaly, or ownership guarantees

Avoid making these decisions accidentally:

* whether numeric strings and numeric primitives normalize identically
* whether numeric strings are canonical-only or quietly broaden into a larger parser contract
* whether negative epoch values are treated as valid timestamps or blocked by an artificial calendar cutoff
* whether the first ingress contract is sync-only or quietly grows async semantics
* whether mapper exceptions are anomalies or hard failures
* whether payload is preserved by reference or copied
* whether dependency collections are copied, frozen, or both
* whether translation anomalies are stable enough for downstream tooling to key against
