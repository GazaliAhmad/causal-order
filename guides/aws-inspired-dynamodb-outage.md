# AWS-Inspired DynamoDB Outage Exercise

This guide documents an AWS-inspired streaming outage exercise for `causal-order`.

It is inspired by the `US-East` DynamoDB event from `September 20, 2015`.
It is not a claim that this project recreates Amazon's internal systems or reproduces the exact outage mechanics.

The goal here is narrower and more honest:

* model the event-processing shape of a metadata-coordination failure
* keep delayed reconnect history visible
* surface retry, duplicate, and invalid survivor pressure
* observe correction churn, watermark behavior, memory, and GC posture under sustained streaming

## Available Assets

Two project assets cover this exercise directly:

* the small human-readable fixture: [test/fixtures/aws-inspired-dynamodb-us-east-2015.mjs](../test/fixtures/aws-inspired-dynamodb-us-east-2015.mjs)
* the matching scenario tests: [test/scenarios/aws-inspired-dynamodb-us-east-2015.test.mjs](../test/scenarios/aws-inspired-dynamodb-us-east-2015.test.mjs)

Those tests are part of the normal suite through [test/run.mjs](../test/run.mjs).

## What Was Included In The Modeled Run

The AWS-inspired dynamic run included:

* a named `metadata-service`
* named storage nodes such as `storage-01` through `storage-20`
* named dependent services such as `sqs`, `autoscaling`, `cloudwatch`, and `aws-console`
* explicit dependency chains from metadata trouble into storage withdrawal and then into dependent-service fallout
* delayed storage-node reconnect waves
* late-arrival handling under `lateArrivalPolicy: "emit_correction"`
* replay-like duplicate pressure on delayed storage nodes
* intentionally invalid clock survivors during the reconnect phase
* incremental async generation for the `1,000,000` event run so stream memory reflected the stream itself rather than one giant prebuilt array
* GC observation through Node runtime flags during the large run

In other words, the modeled run focused on the event-history and reconciliation shape of the incident, not on cloud-infrastructure fidelity.

## What Was Explicitly Excluded

The exercise did not try to reproduce:

* Amazon's actual metadata-service implementation
* the real internal membership formats or index metadata growth paths
* real network-disruption mechanics inside AWS
* true storage-fleet topology or node counts
* real customer error-rate curves
* actual `SQS`, `Auto Scaling`, `CloudWatch`, or AWS Console implementations
* cross-service control-plane capacity management inside AWS
* the exact operational recovery procedures Amazon used

So this is best read as:

* an outage-shape analog

not as:

* a historical simulator of AWS internals

## Small Human-Readable Fixture

The small fixture keeps the story readable:

* `metadata-membership-overloaded`
* `storage-12-withdrew`
* `sqs-request-stalled`
* `autoscaling-health-delayed`
* `cloudwatch-alarm-lagged`
* `console-status-stale`
* `metadata-capacity-added`
* delayed `storage-07` reconnect history
* a replayed `storage-07-membership-retry`
* an invalid `storage-07-membership-corrupt`

That fixture gives two useful lenses:

* a streaming delayed-reconnect story
* a smaller replay-corruption slice

The scenario tests confirm that:

* delayed storage history becomes correction-capable late-arrival output
* service fallout stays visible
* replay duplicates stay visible
* invalid reconnect survivors surface as anomalies instead of crashing the run

## Small Fixture Results

The direct fixture run produced:

* `4` stream batches
* `2` correction batches
* correction triggers:
  * `storage-07-membership-check`
  * `storage-07-membership-retry`
* `late_arrival` anomalies on the delayed storage events
* `missing_sequence` anomalies on the dependent service events
* an `invalid_clock` anomaly for `storage-07-membership-corrupt`

The replay slice produced:

* `3` ordered events
* `1` invalid event
* anomalies:
  * `duplicate_event`
  * `invalid_clock`
  * `sequence_regression`

This is the human-sized version of the larger streaming storm.

## Million-Record Procedure

The large run is now available both as a checked-in repo command and as a manually triggered GitHub Actions confidence workflow.

Checked-in command:

* `npm run bench:aws:incident`
* `npm run bench:aws:incident:gc`

The GC-observed command uses:

* `--expose-gc`
* `--max-old-space-size=256`

The matching GitHub Actions workflow is manual-only:

* `Manual AWS Incident Confidence`

It uploads a summary artifact with runtime, anomaly counts, correction counts, and memory snapshots.

Procedure:

1. build the package with `npm run build`
2. run a one-off Node script from the project root
3. use `orderEventStream()` with an incremental async source
4. use `ingestedAtWatermark`
5. set `lateArrivalPolicy: "emit_correction"`
6. observe memory and GC with:
   * `--expose-gc`
   * `--max-old-space-size=256`

Key stream settings:

* total events: `1,000,000`
* batch size: `256`
* `maxLateArrivalMs`: `120_000n`
* delayed storage nodes: `18`
* disruption start sequence: `2400`
* disruption duration sequence window: `9000`
* duplicate pressure: every `13`
* invalid-clock pressure: every `31` during the delayed reconnect phase

The source was incremental.
That matters because it isolates stream behavior from the artificial cost of materializing one full million-event array before streaming begins.

## Million-Record Results

The AWS-inspired `1,000,000` event stream run produced:

* ordered events: `994,359`
* anomalies: `923,232`
* emitted batches: `923,232`
* correction batches: `917,590`
* late-arrival anomalies: `917,590`
* final batches: `1`
* max batch events: `76,770`
* max anomalies in one batch: `2`
* runtime: `21,463.57 ms`

Observed anomaly mix:

* `late_arrival`: `917,590`
* `invalid_clock`: `5,641`
* `sequence_regression`: `1`

Top ordered event types included:

* `storage.rejoin`: `398,937`
* `dependent.recovery`: `204,798`
* `storage.serve_requests`: `66,001`
* `storage.membership_retry`: `56,406`
* `storage.membership_timeout`: `56,405`
* `storage.self_disqualified`: `56,405`

The first correction triggers were:

* `storage-01-evt-2400`
* `storage-02-evt-2400`
* `storage-03-evt-2400`
* `storage-04-evt-2400`
* `storage-05-evt-2400`

That is the key operational signal from the run:

* the outage analog does not show up as one neat failure marker
* it shows up as a reconciliation storm

## Memory And GC Results

For the same `1,000,000` event run:

* heap baseline after pre-GC: `4.52 MiB`
* heap before forced post-run GC: `32.14 MiB`
* heap after forced post-run GC: `4.93 MiB`
* peak heap: `211.31 MiB`
* peak RSS: `320.60 MiB`
* observed GC events: `0`
* observed GC total: `0.00 ms`
* observed max GC pause: `0.00 ms`

That does not mean garbage collection is impossible in principle.
It means this particular incremental stream run did not show GC as an observable hot-path bottleneck in the measurement path we used.

The more important practical result is:

* correction churn bent first
* memory stayed bounded enough that the stream remained operational

In these incremental streaming runs, the engine's retained working set stayed operationally bounded relative to total processed message volume instead of growing linearly with the full event count.
That is encouraging evidence for long-running stream use, but it is not yet a universal proof of strict `$O(1)$` space under all workloads or an unconditional guarantee for infinite production runtimes.

## What The Library Actually Proved

This exercise showed that `causal-order` can:

* keep delayed reconnect history visible as late arrivals
* emit correction-capable follow-up batches instead of flattening the outage into one fake clean timeline
* preserve the distinction between service fallout that arrived on time and storage history that arrived operationally late
* surface invalid reconnect survivors as anomalies
* keep duplicate replay pressure visible
* stay operational under a large correction-heavy streaming run

It did not prove:

* that the real AWS incident would look exactly like this event history
* that the library models Amazon's infrastructure behavior
* that this fixture predicts real cloud-service blast radius or recovery time

## How To Read This Exercise

Use this guide as:

* a realistic distributed-event outage analog
* a stress story for delayed reconnect and correction-heavy streams
* a demonstration that the library treats anomalies and corrections as part of the answer

Do not use it as:

* a forensic reconstruction of AWS internals
* evidence that the project reproduces the actual DynamoDB outage

If you want the smaller narrative version first, start with the fixture and scenario test.
If you want the scaling story, use the million-record procedure and results described here.
