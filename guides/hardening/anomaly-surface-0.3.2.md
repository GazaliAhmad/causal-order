# Anomaly Surface Audit

This guide explains how the current anomaly surface maps to the `0.3.2` production-gate categories.

The goal is not to claim that every important failure shape has a dedicated anomaly type.
The goal is to make clear which cases are already surfaced directly, which are surfaced indirectly, and which limitations are part of the current payload-agnostic core.

## Why This Exists

`0.3.2` is the milestone where the current `0.3.1` contract is being defended as production-credible on its own terms.

That means the repository should be explicit about two things:

* what anomalies the runtime already emits today
* where the current implementation relies on ordering conclusions and general corruption signals rather than on a dedicated anomaly for one named scenario

If a current-core signal is missing, the honest choices are:

* add it if it still fits the payload-agnostic core
* or state the limitation clearly instead of implying that the signal already exists

## Current Anomaly Types

The current runtime anomaly surface includes:

* `invalid_clock`
* `future_timestamp`
* `duplicate_event`
* `missing_sequence`
* `sequence_regression`
* `same_node_sequence_conflict`
* `causal_inversion`
* `unknown_order`
* `late_arrival`

These are the anomalies the current release line can already emit directly.

## Gate-Category Mapping

### Missing Parent Events

Current status:

* supported as a current-core gate category
* no dedicated `missing_parent` anomaly exists today

Current behavior:

* missing parent references do not invent causal evidence
* ordering can still proceed using other supported evidence such as same-node sequence

Why this is still acceptable for `0.3.2`:

* the current core already behaves honestly by refusing to fabricate parent support
* this is a representational limitation, not silent false certainty

Current limitation:

* missing parent references are currently expressed through preserved ordering limits rather than through a dedicated anomaly type

### Offline Device Merge

Current status:

* supported by the current ordering model
* no dedicated `offline_device_merge` anomaly exists today

Current behavior:

* same-node monotonic sequence can preserve local device history
* misleading ingest-time appearance does not override supported same-node evidence

Why this is still acceptable for `0.3.2`:

* this gate category is primarily about preserving correct local-history conclusions under delayed sync
* the current core does that without pretending there is a domain-specific "offline merge" anomaly

Current limitation:

* the runtime does not try to infer domain-aware offline-sync semantics beyond the current ordering and anomaly model

### Duplicate Event Storms For Exact Duplicate IDs

Current status:

* directly surfaced today

Current behavior:

* exact duplicate IDs emit `duplicate_event`
* large replay or duplicate-heavy workloads can still be ordered without hiding that corruption signal

This is one of the strongest current anomaly categories because the runtime has a direct, machine-readable signal for the exact failure shape.

### Clock Reset Scenarios

Current status:

* partially surfaced today
* no dedicated `clock_regression` anomaly is emitted by the current batch analysis path

Current behavior:

* same-node resets that show up as backward sequence movement can emit `sequence_regression`
* invalid clock structure still emits `invalid_clock`

Why this is still acceptable for `0.3.2`:

* the current release gate is about defending the current semantics honestly, not pretending the library already has a richer clock-reset diagnosis model than it does

Current limitation:

* `clock_regression` exists in the public anomaly type surface, but the current implementation does not yet emit it directly as a dedicated same-node clock-reset signal

### Massive Out-Of-Order Replay

Current status:

* supported primarily through stable ordering conclusions plus general corruption signals

Current behavior:

* same-node sequence can restore the truthful local order
* replay-heavy corruption may also surface `duplicate_event` or `sequence_regression`, depending on the concrete data shape

Why this is still acceptable for `0.3.2`:

* the production gate is about whether the library preserves honest conclusions under replay-heavy input
* it does not require a dedicated `replay_event` anomaly type

Current limitation:

* there is no replay-specific anomaly type today; replay scenarios are represented through the existing generic anomaly surface plus stable ordering behavior

### Partial Log Corruption

Current status:

* directly supported through the existing general corruption anomalies

Current behavior:

* malformed records emit `invalid_clock`
* missing sequence metadata emits `missing_sequence`
* duplicate IDs emit `duplicate_event`
* same-node backward movement can emit `sequence_regression`
* unresolved causal placement can emit `unknown_order`

This category already fits the current payload-agnostic anomaly model well because it is naturally expressed as a mix of generic corruption signals rather than as one domain-specific anomaly.

## Streaming Limitation Reminder

For streaming, the current anomaly story is intentionally narrower across emitted windows:

* `duplicate_event`
* `sequence_regression`
* `same_node_sequence_conflict`
* `causal_inversion`
* `unknown_order`

are only guaranteed within the currently buffered window that is flushed together.

Across earlier emitted windows, the currently retained relational anomaly carry is:

* `late_arrival` only

This is already part of the current stream contract and should remain explicit in the `0.3.2` release story.

## Audit Outcome

The current anomaly surface is sufficient for `0.3.2` if the repo stays honest about the distinction between:

* direct anomaly support
* indirect support through stable ordering conclusions
* explicit current limitations

The most important limitation to keep visible today is this:

* some production-gate categories are defended by ordering behavior plus generic anomalies, not by a dedicated scenario-named anomaly type

That is acceptable for `0.3.2` as long as the docs and release wording do not imply a richer anomaly diagnosis model than the runtime currently provides.
