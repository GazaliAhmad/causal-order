import assert from "node:assert/strict"

import { orderEventStream } from "../../dist/index.js"
import { collectAsync, makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("orderEventStream flags late arrivals instead of hiding them by default", async () => {
  const events = [
    makeEvent({ id: "evt-1", physicalTimeMs: 100_000n }),
    makeEvent({ id: "evt-2", physicalTimeMs: 140_000n }),
    makeEvent({ id: "evt-late", physicalTimeMs: 105_000n }),
  ]

  async function* source() {
    for (const event of events) {
      yield event
    }
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "flag",
    strict: false,
  }))

  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "late_arrival"),
  ))
})

test("orderEventStream can reject late arrivals in fail mode", async () => {
  const events = [
    makeEvent({ id: "evt-1", physicalTimeMs: 100_000n }),
    makeEvent({ id: "evt-2", physicalTimeMs: 140_000n }),
    makeEvent({ id: "evt-late", physicalTimeMs: 105_000n }),
  ]

  async function* source() {
    for (const event of events) {
      yield event
    }
  }

  await assert.rejects(
    collectAsync(orderEventStream(source(), {
      batchSize: 1,
      maxLateArrivalMs: 30_000n,
      lateArrivalPolicy: "fail",
      strict: false,
    })),
    /Late arrival rejected/,
  )
})

test("orderEventStream only marks the terminal batch as final in emit-correction mode", async () => {
  const events = [
    makeEvent({ id: "evt-1", physicalTimeMs: 100_000n }),
    makeEvent({ id: "evt-2", physicalTimeMs: 140_000n }),
    makeEvent({ id: "evt-late", physicalTimeMs: 105_000n }),
  ]

  async function* source() {
    for (const event of events) {
      yield event
    }
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "emit_correction",
    strict: false,
  }))

  assert.ok(batches.length >= 2)
  assert.equal(
    batches.slice(0, -1).some((batch) => batch.isFinal),
    false,
  )
  assert.equal(batches.at(-1)?.isFinal, true)
  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "late_arrival"),
  ))
})

test("orderEventStream surfaces invalid events as anomalies in non-strict mode", async () => {
  async function* source() {
    yield {
      id: "evt-invalid",
      nodeId: "node-a",
      payload: { type: "broken" },
    }
    yield makeEvent({ id: "evt-valid", physicalTimeMs: 1_000n })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    strict: false,
  }))

  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "invalid_clock"),
  ))
  assert.ok(batches.some((batch) =>
    batch.events.some((entry) => entry.event.id === "evt-valid"),
  ))
})
