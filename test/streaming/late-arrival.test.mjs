import assert from "node:assert/strict"

import {
  createProcessingTimeWatermark,
  ingestedAtWatermark,
  orderEventStream,
} from "../../dist/index.js"
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

test("orderEventStream can drop late arrivals while still surfacing the anomaly", async () => {
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
    batchSize: 2,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "drop",
    strict: false,
  }))

  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "late_arrival"),
  ))
  assert.equal(
    batches.some((batch) =>
      batch.events.some((entry) => entry.event.id === "evt-late"),
    ),
    false,
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

test("orderEventStream flushes a correction-capable batch immediately when a late event arrives", async () => {
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
    batchSize: 10,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "emit_correction",
    strict: false,
  }))

  assert.ok(batches.length >= 2)
  assert.ok(batches.some((batch) =>
    batch.events.some((entry) => entry.event.id === "evt-late"),
  ))
  assert.equal(
    batches.slice(0, -1).some((batch) =>
      batch.events.some((entry) => entry.event.id === "evt-late") && batch.isFinal,
    ),
    false,
  )
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

test("orderEventStream does not let invalid events advance the watermark by default", async () => {
  async function* source() {
    yield makeEvent({ id: "evt-1", physicalTimeMs: 100_000n })
    yield {
      id: "evt-invalid",
      nodeId: "node-a",
      payload: { type: "broken" },
      ingestedAt: 500_000n,
    }
    yield makeEvent({ id: "evt-2", physicalTimeMs: 140_000n })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 2,
    maxLateArrivalMs: 30_000n,
    strict: false,
  }))

  assert.equal(batches[0]?.events.length, 0)
  assert.equal(batches[0]?.watermark, 70_000n)
  assert.ok(batches[0]?.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))
  assert.ok(batches[1]?.events.some((entry) => entry.event.id === "evt-1"))
  assert.equal(batches[1]?.watermark, 110_000n)
})

test("orderEventStream can use ingestedAt-based watermark helpers for more aggressive progress", async () => {
  async function* source() {
    yield makeEvent({
      id: "evt-1",
      physicalTimeMs: 100_000n,
      ingestedAt: 100_000n,
    })
    yield makeEvent({
      id: "evt-2",
      physicalTimeMs: 105_000n,
      ingestedAt: 200_000n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 2,
    maxLateArrivalMs: 30_000n,
    watermark: ingestedAtWatermark,
    strict: false,
  }))

  assert.equal(batches[0]?.watermark, 170_000n)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-1", "evt-2"],
  )
})

test("orderEventStream accepts opt-in processing-time watermark helpers", async () => {
  async function* source() {
    yield makeEvent({ id: "evt-1", physicalTimeMs: 100_000n })
  }

  const watermark = createProcessingTimeWatermark({
    now: () => 200_000n,
  })

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 30_000n,
    watermark,
    strict: false,
  }))

  assert.equal(batches[0]?.watermark, 170_000n)
})

test("orderEventStream rejects invalid stream options", async () => {
  async function* source() {
    yield makeEvent()
  }

  await assert.rejects(
    collectAsync(orderEventStream(source(), {
      batchSize: 0,
      strict: false,
    })),
    /batchSize/,
  )

  await assert.rejects(
    collectAsync(orderEventStream(source(), {
      maxLateArrivalMs: -1n,
      strict: false,
    })),
    /maxLateArrivalMs/,
  )

  await assert.rejects(
    collectAsync(orderEventStream(source(), {
      watermark: () => -1n,
      strict: false,
    })),
    /Watermark strategy/,
  )
})
