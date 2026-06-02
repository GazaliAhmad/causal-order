# Policy Guidance

This guide is the package-facing decision layer for two operational choices:

* when to prefer `strict: true` versus `strict: false`
* how to choose `lateArrivalPolicy` for streaming workloads

It is not trying to restate every semantic detail from the deeper guides.
It is trying to answer the practical question:

* what is the safer default for this workload?

## The Short Version

Use `strict: false` when you need the library to keep moving and surface problems as structured anomalies.

Use `strict: true` when invalid or unresolved ordering should stop the workflow immediately rather than become provisional output.

One mental model helps:

* `strict` is the main fail-fast switch for ordering and validation
* `allowUnknownOrder` is the uncertainty-visibility control layered on top of non-strict output
* `detectAnomalies` is a diagnostic-output control, not a correctness mode

Translation fail-fast behavior is still configured separately through `translateBatch()` policy.

For streaming late arrivals:

* use `flag` when you want to keep delayed events visible without triggering correction output
* use `drop` when late events should not enter the emitted stream but still need anomaly visibility
* use `emit_correction` when previously emitted non-final output may need reconciliation
* use `fail` when a late arrival should be treated as an operational contract violation

## Choosing `strict`

### Prefer `strict: false` when

* you are exploring or debugging mixed real-world data
* you want anomalies recorded instead of the whole batch or stream aborting
* upstream quality is uneven and you still need a bounded operational answer
* you are evaluating the library on realistic messy inputs

Typical shape:

```ts
import { orderEvents, translateBatch } from "causal-order"

const translated = translateBatch(records, config)

const result = orderEvents(translated.translated, {
  strict: false,
  detectAnomalies: true,
})
```

What this buys you:

* invalid records can still be surfaced as anomalies instead of crashing the whole run
* unresolved ordering can still be written deterministically with warnings
* the anomaly stream stays part of the operational answer
* translation ingress policy can still be tightened independently if you need fail-fast onboarding before ordering

### Prefer `strict: true` when

* audit and compliance pipelines should stop rather than publish uncertain output
* financial or regulated processing requires fail-fast behavior
* CI and fixture verification should reject invalid or unresolved ordering immediately
* upstream data-quality enforcement matters more than partial output
* producer debugging and contract testing should catch bad input as early as possible

Typical shape:

```ts
import { orderEvents } from "causal-order"

const result = orderEvents(events, {
  strict: true,
  detectAnomalies: true,
})
```

What this buys you:

* invalid input does not quietly become a provisional answer
* dependency cycles and other unresolved cases stop the run
* mistakes are found earlier in pipelines that are supposed to be contract-clean

## Choosing `lateArrivalPolicy`

`lateArrivalPolicy` only matters for `orderEventStream()`.
It is about what to do when an event arrives after the active watermark boundary.

### `flag`

Use `flag` when:

* you want late events to stay visible in emitted output
* you do not want correction metadata or reconciliation flow
* delayed events are normal and downstream consumers can tolerate them as late-but-visible output

Typical shape:

```ts
import { orderEventStream } from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 100,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "flag",
  strict: false,
})) {
  await applyBatch(batch)
}
```

Choose `flag` for:

* general observability pipelines
* operational monitoring where visibility matters more than correction flow
* reconnect cases where consumers can interpret late events directly

### `drop`

Use `drop` when:

* late events should not enter the emitted ordered stream
* you still need anomaly visibility for those drops
* the downstream projection should stay narrow even when input is noisy

Choose `drop` for:

* real-time dashboards that should stay focused on current windows
* ephemeral alerting views
* projections where old late data is less useful than a clean current slice

Be careful:

* dropped late events are still important operationally
* if the delayed data matters for truth, `drop` is probably the wrong choice

### `emit_correction`

Use `emit_correction` when:

* late arrivals should remain visible
* previously emitted non-final output may need reconciliation
* reconnect-heavy or offline-sync flows are part of the real workload

Typical shape:

```ts
import {
  ingestedAtWatermark,
  orderEventStream,
} from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 500,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "emit_correction",
  watermark: ingestedAtWatermark,
  strict: false,
})) {
  await applyBatch(batch)
}
```

Choose `emit_correction` for:

* delayed reconnect flows
* offline sync recovery
* systems that keep publishing while one producer or region reconnects later

Be careful:

* non-final output must be treated as replaceable derived state
* this is an operational reconciliation signal, not proof of causal completeness

### `fail`

Use `fail` when:

* a late arrival is a contract violation, not a recoverable condition
* downstream consumers should stop rather than reconcile
* the stream boundary is intentionally strict

Choose `fail` for:

* compliance or regulated streaming paths
* stream-based contract tests
* workloads where lateness itself means the data is operationally unacceptable

## Practical Defaults

If you are unsure, start here:

* bounded batch replay, audit, or debugging: `strict: false` first, then tighten to `strict: true` once the input contract is clean
* producer contract tests or CI verification: `strict: true`
* ordinary continuous streaming: `lateArrivalPolicy: "flag"` with `strict: false`
* reconnect-heavy or offline-sync streaming: `lateArrivalPolicy: "emit_correction"` with `strict: false`
* regulated streaming where lateness is unacceptable: `lateArrivalPolicy: "fail"`

## One Rule To Keep

Do not choose a stricter setting just because it sounds safer in the abstract.
Choose it when the surrounding workflow is actually prepared to stop, reject, or reconcile based on that signal.

The honest answer is:

* `strict: false` is often the safer operational default during exploration and recovery
* `strict: true` is often the safer governance default once the contract must be enforced
