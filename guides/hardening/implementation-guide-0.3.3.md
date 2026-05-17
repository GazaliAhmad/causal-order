# `0.3.3` Implementation Guide

This note records the `0.3.3` implementation work in a scoped, commit-friendly shape.

It does not prescribe code structure in advance.
It keeps the shipped sequencing clear:

* add pressure visibility first
* change runtime behavior second
* tighten guards only after the new pressure cases are understood

For the broader milestone intent, see:

* [Streaming Hardening And Pressure `0.3.3`](./streaming-hardening-0.3.3.md)

## Working Rule

`0.3.3` was implemented in small chunks that separate:

* new pressure profiles
* new benchmark visibility
* new test pressure
* runtime optimization
* guardrail promotion
* release wording

The repo should avoid mixing those together unless there is a strong reason.

## Sub-Goal

`0.3.3` makes stream memory pressure observable before making it enforceable.

That means:

* do not start by redesigning the stream path
* do not start by inventing hard memory thresholds
* do start by making pressure easier to see in the current runtime

For stream stress scale, the released working posture is:

* keep `100k` as the routine stream comparison band
* treat `150k` as the main `0.3.3` stream stress-visibility band
* treat `250k` as exploratory stretch visibility rather than as a default guard candidate

## Chunk Order

The landed order was:

1. stream pressure profile scaffolding
2. richer stream benchmark visibility
3. broader exploratory stream fuzzing
4. heavier correction and reconnect pressure cases
5. heavier watermark-lag and bounded-memory pressure cases
6. stream-path optimization
7. anomaly-path optimization
8. stable stream guard promotion
9. docs and changelog cleanup

The early chunks were still pressure-evidence work, not runtime redesign work.
They widened the pressure story around:

* reconnect churn
* correction churn
* watermark lag
* partial ready subsets
* bounded-memory pressure

Only after that pressure surface was clearer did the repo change the runtime.
That later work stayed split between:

* stream buffer and flush-path changes
* anomaly-path allocation tightening

New stream guards came only after the profile shape was stable and the numbers were repeatable enough to trust.

At the released stage, that means the `150k` sustained watermark-lag profile is the enforced guard, while `250k` remains exploratory and correction-heavy profiles remain visibility-first unless their variance settles further.

Docs were updated after the implementation story became real.
The wording stays disciplined:

* `0.3.2` is the production-credibility gate
* `0.3.3` is the broader streaming pressure and hardening follow-up

## Things To Avoid

Avoid combining these in one commit:

* new pressure profiles plus runtime refactors
* exploratory fuzzing plus new enforced thresholds
* memory-observability metrics plus claims that memory is already a settled contract
* docs wording plus unverified optimization claims
