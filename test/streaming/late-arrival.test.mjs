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
