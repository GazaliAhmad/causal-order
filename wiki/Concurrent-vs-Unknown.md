# Concurrent vs Unknown

Two of the most important concepts in `causal-order` are `concurrent` and `unknown`.

They are not the same thing.

## `concurrent`

`concurrent` means the library can positively justify that there is no supported causal relationship between the events.

This is a meaningful statement.
It does not mean the library failed.
It means the available metadata is strong enough to rule out any supported causal precedence claim.

In many distributed systems, concurrency is real.
Two events may genuinely happen independently.

In current releases, this result is intentionally rare.
The runtime prefers `unknown` over speculative concurrency when the supported evidence is too weak, especially across nodes.

## `unknown`

`unknown` means the metadata is too weak, invalid, or contradictory to justify a reliable claim.

This is different from concurrency.

Concurrency says:

* the library can justify independence within the supported model

Unknown says:

* the library cannot safely interpret this relationship

## Why the Distinction Matters

If a system collapses both ideas into one vague bucket, developers lose an important part of the truth.

The difference affects how a result should be interpreted:

* concurrent events may still be valid and expected
* unknown relationships may point to weak metadata, invalid clocks, or incomplete evidence

This distinction is part of the library’s design philosophy:
do not confuse uncertainty caused by real independence with uncertainty caused by weak or broken inputs.
