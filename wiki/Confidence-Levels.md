# Confidence Levels

One of the most important ideas in `causal-order` is that not all ordering claims are equally strong.

The library uses confidence levels to preserve that distinction.

## `proven`

`proven` means the order is backed by explicit causal evidence.

Examples:

* same-node sequence progression
* known parent-child relationships
* explicit dependency edges

This is the strongest kind of claim the library makes.

## `derived`

`derived` means the order was inferred from metadata that is useful but not fully causal.

Examples:

* HLC order
* ingestion metadata
* sequence presence without a stronger explicit relationship

This is often operationally useful, but it should not be confused with proof.

## `fallback`

`fallback` means the library had to impose a deterministic order because the input still needed a stable output shape.

This is a stability tool, not a truth claim.

A fallback answer may be helpful for reproducibility, but it should never be mistaken for strong evidence.

## `unknown`

`unknown` means the library cannot honestly justify a reliable order.

This is not a failure of the project.
It is part of the honesty of the model.

Sometimes the correct answer is not “A before B.”
Sometimes the correct answer is:

* we do not know
* we cannot prove this
* these should not be collapsed into a fake certainty

## Why This Matters

Without confidence levels, many systems silently upgrade weak signals into strong claims.

`causal-order` exists partly to stop that upgrade from happening invisibly.
