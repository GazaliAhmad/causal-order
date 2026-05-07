# Concurrent vs Unknown

Two of the most important concepts in `causal-order` are `concurrent` and `unknown`.

They are not the same thing.

## `concurrent`

`concurrent` means there is no known causal relationship between the events.

This is a meaningful statement.
It does not mean the library failed.
It means the available metadata does not show one event causing or preceding the other.

In many distributed systems, concurrency is real.
Two events may genuinely happen independently.

## `unknown`

`unknown` means the metadata is too weak, invalid, or contradictory to justify a reliable claim.

This is different from concurrency.

Concurrency says:

* these events appear independent

Unknown says:

* the library cannot safely interpret this relationship

## Why the Distinction Matters

If a system collapses both ideas into one vague bucket, developers lose an important part of the truth.

The difference affects how a result should be interpreted:

* concurrent events may still be valid and expected
* unknown relationships may point to weak metadata, invalid clocks, or incomplete evidence

This distinction is part of the library’s design philosophy:
do not confuse uncertainty caused by real independence with uncertainty caused by weak or broken inputs.
