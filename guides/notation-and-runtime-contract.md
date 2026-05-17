# Notation And Runtime Contract

This guide separates two things that are easy to blur together:

* the conceptual relationship between two events
* the current runtime contract for emitted order and confidence

They are related, but they are not the same layer.

The short version is:

* the library distinguishes between what it can justify about `A` versus `B`
* and what order it still has to emit for operational use

That difference is why pairwise `unknown` can still become emitted `fallback`.

## Quick Example

Suppose two cross-node events arrive with no explicit parent or dependency link:

```txt
A ? B
```

That is the honest pairwise answer.
The library cannot justify either direction strongly enough.

But if a batch or ready stream window still needs a stable output order, the runtime may emit:

```txt
A < B [fallback]
```

That does not mean the library proved `A` happened before `B`.
It means the runtime had to produce a deterministic output order while still marking it as weakly justified.

`fallback` is not the happy path.
It is the deterministic safety path when stronger evidence is not available.

## Conceptual Layer

At the conceptual level, these four notations are useful:

* `A < B`
* `B < A`
* `A || B`
* `A ? B`

Meaning:

* `A < B`
  `A` is before `B`
* `B < A`
  `B` is before `A`
* `A || B`
  `A` and `B` are independent for ordering purposes
* `A ? B`
  the relationship cannot be justified honestly from the available evidence

This layer is useful because it matches how people naturally talk about event relationships.

## Current Runtime Layer

The current runtime is stricter than that conceptual layer.

For pairwise comparison, the active runtime is closer to:

* `A < B`
* `B < A`
* `A = B`
* `A ? B`

In other words, the current runtime does not make `A || B` a first-class exported pairwise result in the same way.

For emitted ordered output, the library uses confidence labels:

* `proven`
* `derived`
* `fallback`
* `unknown`

Those confidence labels describe how an emitted ordered row was justified.
They do not mean the same thing as the conceptual pairwise notations.

## Recommended Repo-Native Notation

For docs in this repository, the safest notation is:

Relation:

* `A < B`
* `B < A`
* `A = B`
* `A ? B`

Confidence:

* `[proven]`
* `[derived]`
* `[fallback]`
* `[unknown]`

Examples:

```txt
A < B [proven]
A < B [derived]
A < B [fallback]
A ? B [unknown]
```

This keeps the layers separate:

* relation says what the library is claiming about `A` versus `B`
* confidence says how strong the emitted justification is

## What The Library Does In Practice

The current runtime behaves like this:

* if explicit causal evidence exists, it can emit `A < B [proven]`
* if weaker but still useful metadata supports the order, it can emit `A < B [derived]`
* if a stable output still has to be produced without strong evidence, it can emit `A < B [fallback]`
* if the pairwise relationship cannot be justified, it stays `A ? B`

The important practical rule is:

* pairwise `A ? B` does not automatically mean emitted `confidence: "unknown"`

The runtime often still writes a deterministic output order for operational use, but marks it as:

* `derived`
* or `fallback`

Only harder unresolved ordering cases emit ordered rows with `confidence: "unknown"`.

For a full walkthrough of how that shows up in batch and stream output, see:

* [How Order Is Written](./how-order-is-written.md)

## Why The Runtime Does Not Fully Implement The Conceptual Layer

The main reason is practical honesty.

Conceptually, `A || B` is attractive because people want a clean way to say:

* these events do not appear ordered

But the runtime avoids overusing that label for several reasons.

### Reason 1: Missing evidence is not the same as justified independence

Across nodes, weak metadata often means:

* no supported causal link is present
* the metadata may be incomplete
* the system may simply not know enough yet

So the runtime prefers:

* `A ? B`

over:

* `A || B`

That avoids turning missing evidence into a positive concurrency claim.

### Reason 2: Batch and stream output still need stable rows

The library is not only a conceptual comparator.
It is also an operational ordering tool.

That means batch and stream output often still need:

* deterministic row order
* stable replay behavior
* reproducible downstream results

So even when the conceptual relationship is unresolved, the runtime may still emit one row before another with:

* `derived`
* or `fallback`

That output order is operational, not a claim of stronger causal truth.

This is especially important for `fallback`.

Without deterministic fallback behavior, many real outputs would stop at:

* `A ? B`

That may be conceptually honest, but it is often operationally incomplete.

Batch and stream consumers still need:

* stable output rows
* reproducible replay behavior
* deterministic downstream processing

So `fallback` exists to keep the output usable without pretending the relationship was strongly justified.

In that sense:

* `unknown` preserves honesty at the relationship layer
* `fallback` preserves usability at the emitted-output layer

### Reason 3: Emitted order and pairwise truth are different jobs

The pairwise layer answers:

* what can the library justify about `A` versus `B`?

The emitted output layer answers:

* how should the library write a usable ordered result for this batch or flushed stream window?

Those are different questions.

Trying to force them into one notation makes the docs and the runtime easier to misread.

### Reason 4: Streaming adds readiness and finality constraints

In streaming mode, the runtime does not only care about causality.
It also cares about:

* watermark progress
* late-arrival policy
* what is ready to flush now

So even if two events are conceptually independent, the stream still has to decide:

* what to emit in the current ready window
* what to hold back
* when to emit correction-capable output

That pushes the implementation toward explicit operational output semantics rather than a pure conceptual concurrency model.

## Practical Reading Rule

When reading current runtime output, use this rule:

* `A ? B` means the pairwise relationship is not honestly justified
* `A < B [fallback]` means the library still had to write a stable output order
* `A < B [derived]` means the order is useful operationally, but not explicit causal proof
* `A < B [proven]` means the order is backed by explicit supported causal evidence

And if you want to talk informally about conceptual concurrency in prose, that is still fine.
Just do not treat conceptual `A || B` as if it were the same thing as the current runtime's main exported pairwise result.

## Bottom Line

Conceptually, all four notations are useful:

* `A < B`
* `B < A`
* `A || B`
* `A ? B`

Practically, the current runtime is stricter:

* it keeps unresolved cross-node relationships as `A ? B`
* it emits deterministic output separately through `proven`, `derived`, `fallback`, and `unknown`

That split is intentional.
It helps the library stay operationally useful without pretending that weak evidence is the same thing as justified concurrency.
