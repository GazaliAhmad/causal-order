# Case Studies

These case studies show how `causal-order` handles timelines that look straightforward at first glance, but become misleading once distributed-system realities are taken seriously.

The point is not only what the library outputs.
It is why the library refuses certain stronger claims.

These scenarios are also the right seeds for larger `0.2.2` corrupted-dataset stress profiles.
They represent realistic failure shapes that can be expanded into heavier benchmark inputs without changing the semantic question being tested.

## 1. Multi-Region Clock Drift

### Scenario

A user action is observed across different regions:

* Singapore API: `user.created`
* US worker: `email.sent`
* EU database: `billing.initialized`

The fixture for this case is in [test/fixtures/multi-region-drift.mjs](../test/fixtures/multi-region-drift.mjs).

### What Looks Tempting

A plain timestamp sort suggests:

1. US worker event
2. Singapore API event
3. EU database event

That looks clean, but it does not prove causal order across those nodes.

### What `causal-order` Does

The scenario test in [test/scenarios/multi-region-drift.test.mjs](../test/scenarios/multi-region-drift.test.mjs) confirms that these events remain `derived`, not `proven`.

Why:

* they are on different nodes
* they do not expose `parentEventId`
* they do not expose `dependencyEventIds`
* they do not share same-node sequence evidence

So the library still emits a deterministic order for operational use, but only on an `hlc` basis with `derived` confidence.

### Solution

Treat the output as a usable processing order, not a causal proof.

If you need stronger claims across regions, provide explicit causal links such as:

* `parentEventId`
* `dependencyEventIds`

### Reasoning

This prevents cross-region clock skew from becoming a fake causal story.

The library is willing to say:

* "this is the deterministic order we can apply"

But it is not willing to say:

* "this is the causal truth"

## 2. Replay Corruption

### Scenario

An older event is replayed later with newer metadata:

* original `order-created-1`
* causally linked `payment-captured-1`
* replayed duplicate `order-created-1` from a replay job

The fixture is in [test/fixtures/replay-corruption.mjs](../test/fixtures/replay-corruption.mjs), and the scenario test is in [test/scenarios/replay-corruption.test.mjs](../test/scenarios/replay-corruption.test.mjs).

### What Looks Tempting

A naive system might absorb the replayed event and present a clean-looking later timeline, as if the data were simply newer.

That would hide the fact that the event identity was duplicated and that replay activity distorted the timeline.

### What `causal-order` Does

The library:

* preserves the original `order-created-1`
* keeps `payment-captured-1` as `proven` because it explicitly points to the original parent
* keeps the replayed duplicate visible instead of silently merging it away
* emits anomalies including:
  * `duplicate_event`
  * `causal_inversion`

### Solution

Use the anomaly stream as part of the answer, not as extra noise to ignore.

When replays exist:

* do not collapse duplicates into one neat event history
* keep explicit causal edges authoritative
* treat duplicate identity and inversion warnings as evidence of corruption or replay effects

### Reasoning

The library is protecting you from a false "clean" timeline.

A clean timeline is only useful if it is also true.

## 3. Offline Sync Anomalies

### Scenario

A mobile device creates and edits data while offline, then syncs later:

* `draft-created`
* `draft-edited`
* `draft-submitted`

Those device events arrive after a server-side event:

* `review-started`

The fixture is in [test/fixtures/offline-sync-anomalies.mjs](../test/fixtures/offline-sync-anomalies.mjs), and the scenario test is in [test/scenarios/offline-sync-anomalies.test.mjs](../test/scenarios/offline-sync-anomalies.test.mjs).

### What Looks Tempting

If ingestion time were treated as truth, the later-arriving device history could be flattened behind the server event and made to look causally later than it really was.

### What `causal-order` Does

For the device-local history, the library prefers same-node monotonic `sequence`:

1. `draft-created`
2. `draft-edited`
3. `draft-submitted`

The later device entries are labeled `proven` because they carry `same_node_sequence` causal evidence.

The server-side event remains separate and only `derived`.

### Solution

When devices can be offline, provide stable same-node sequence metadata and let that outrank misleading ingestion time.

### Reasoning

Offline sync changes when the server sees an event.
It does not rewrite the device's own internal event history.

## 4. The "Unknown" Case Study

### Scenario

Two events look related, but there is no explicit causal link:

* `request-accepted`
* `inventory-checked`

They share:

* the same `traceId`
* the same `partition`

But only a third event, `payment-captured`, explicitly links back to `request-accepted` through `parentEventId`.

The fixture is in [test/fixtures/trace-and-partition-noncausal.mjs](../test/fixtures/trace-and-partition-noncausal.mjs), and the scenario test is in [test/scenarios/trace-and-partition-noncausal.test.mjs](../test/scenarios/trace-and-partition-noncausal.test.mjs).

### What Looks Tempting

It is easy to assume:

* same trace means causal order
* same partition means causal order
* adjacent timestamps inside the same request mean one event caused the other

### What `causal-order` Does

It refuses that upgrade.

In this case:

* `inventory-checked` stays `derived`
* `inventory-checked` has no `causalEvidence`
* `payment-captured` becomes `proven` only because it has explicit `parentEventId`

The pairwise causal rule behind that behavior is covered directly in [test/unit/validation.test.mjs](../test/unit/validation.test.mjs), where valid independent cross-node events without explicit evidence return `unknown`.

### Solution

Treat:

* `traceId` as correlation metadata
* `partition` as scoping metadata

Do not rely on them as proof of causality unless the event model grows stronger explicit evidence in the future.

### Reasoning

Things can look related without being causally justified.

The library would rather preserve uncertainty than reward a plausible-looking guess.

## Summary

Across all four case studies, the pattern is the same:

* deterministic output is useful
* explicit evidence is stronger than plausible metadata
* anomalies are part of the truth, not cleanup noise
* "unknown" is often the honest answer when cross-node evidence is weak

That is the core discipline behind `causal-order`.

## Stress-Hardening Follow-Up

These case studies also map cleanly onto the `0.2.2` corrupted-dataset stress plan:

* multi-region drift expands naturally into sparse-causality and weak-evidence graph pressure
* replay corruption expands naturally into duplicate explosion, replay storms, and inversion-heavy stress
* offline sync anomalies expand naturally into sequence conflicts and large same-timestamp clusters
* the "unknown" case expands naturally into sparse-causality and cross-node ambiguity stress

Additional `0.2.2` stress-only patterns that go beyond these small scenario fixtures include:

* malformed-event ratios
* cyclic dependency attempts

That keeps the relationship clean:

* case studies explain the semantics in human-sized examples
* stress benchmarks pressure-test those same semantics at `150k` scale under corrupted-dataset conditions

If you want the operational scheduled-replay pattern that builds on those same semantics, see [After-Hours Batch Processing](./after-hours-batch-processing.md).
