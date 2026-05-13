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

  assert.deepEqual(batches[0]?.anomalyHorizon, {
    retainedEventHistory: "buffered_window_only",
    crossWindowRelationalDetection: "late_arrival_only",
  })
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
  assert.ok(batches.some((batch) => batch.correction?.reason === "late_arrival"))
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
  const correctionBatch = batches.find((batch) =>
    batch.events.some((entry) => entry.event.id === "evt-late"),
  )
  assert.ok(correctionBatch)
  assert.deepEqual(correctionBatch?.correction, {
    reason: "late_arrival",
    scope: "all_non_final_output",
    triggerEventId: "evt-late",
  })
  assert.equal(
    batches.slice(0, -1).some((batch) =>
      batch.events.some((entry) => entry.event.id === "evt-late") && batch.isFinal,
    ),
    false,
  )
})

test("orderEventStream does not mark ordinary in-window batches as correction batches", async () => {
  async function* source() {
    yield makeEvent({ id: "evt-1", physicalTimeMs: 100_000n })
    yield makeEvent({ id: "evt-2", physicalTimeMs: 140_000n })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "emit_correction",
    strict: false,
  }))

  assert.ok(batches.length >= 1)
  assert.equal(
    batches.every((batch) => batch.correction === undefined),
    true,
  )
})

test("orderEventStream detects duplicate ids when they remain in the same buffered window", async () => {
  async function* source() {
    yield makeEvent({ id: "evt-dup", physicalTimeMs: 100_000n })
    yield makeEvent({ id: "evt-dup", physicalTimeMs: 101_000n })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 10,
    maxLateArrivalMs: 30_000n,
    strict: false,
  }))

  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "duplicate_event"),
  ))
})

test("orderEventStream does not retain emitted history for later duplicate detection", async () => {
  async function* source() {
    yield makeEvent({ id: "evt-dup", physicalTimeMs: 100_000n })
    yield makeEvent({ id: "evt-dup", physicalTimeMs: 200_000n })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 0n,
    strict: false,
  }))

  assert.ok(batches.length >= 2)
  assert.equal(
    batches.some((batch) =>
      batch.anomalies.some((anomaly) => anomaly.type === "duplicate_event"),
    ),
    false,
  )
  assert.deepEqual(batches[0]?.anomalyHorizon, {
    retainedEventHistory: "buffered_window_only",
    crossWindowRelationalDetection: "late_arrival_only",
  })
})

test("orderEventStream does not retain emitted history for later sequence regression detection", async () => {
  async function* source() {
    yield makeEvent({
      id: "evt-1",
      nodeId: "node-a",
      sequence: 5n,
      physicalTimeMs: 100_000n,
    })
    yield makeEvent({
      id: "evt-2",
      nodeId: "node-a",
      sequence: 4n,
      physicalTimeMs: 200_000n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 0n,
    strict: false,
  }))

  assert.ok(batches.length >= 2)
  assert.equal(
    batches.some((batch) =>
      batch.anomalies.some((anomaly) => anomaly.type === "sequence_regression"),
    ),
    false,
  )
})

test("orderEventStream does not force unready events out when batchSize is reached", async () => {
  async function* source() {
    yield makeEvent({ id: "evt-1", physicalTimeMs: 100_000n })
    yield makeEvent({ id: "evt-2", physicalTimeMs: 200_000n })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 0n,
    watermark: () => 0n,
    strict: false,
  }))

  assert.equal(batches.length, 1)
  assert.equal(batches[0]?.isFinal, true)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-1", "evt-2"],
  )
})

test("orderEventStream flushes only the ready subset when batchSize is reached under watermark lag", async () => {
  async function* source() {
    yield makeEvent({
      id: "evt-ready-later",
      physicalTimeMs: 100_000n,
      ingestedAt: 100_000n,
    })
    yield makeEvent({
      id: "evt-still-buffered",
      physicalTimeMs: 200_000n,
      ingestedAt: 200_000n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 2,
    maxLateArrivalMs: 50_000n,
    watermark: (event) => event.ingestedAt,
    strict: false,
  }))

  assert.equal(batches.length, 2)
  assert.equal(batches[0]?.isFinal, false)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-ready-later"],
  )
  assert.deepEqual(
    batches[1]?.events.map((entry) => entry.event.id),
    ["evt-still-buffered"],
  )
  assert.equal(batches[1]?.isFinal, true)
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

test("orderEventStream treats custom watermark values as stream-progress signals", async () => {
  const seenWatermarkInputs = []
  const watermark = (event) => {
    seenWatermarkInputs.push(event.id)
    return event.ingestedAt
  }

  async function* source() {
    yield makeEvent({
      id: "evt-1",
      physicalTimeMs: 100_000n,
      ingestedAt: 100_000n,
    })
    yield makeEvent({
      id: "evt-2",
      physicalTimeMs: 120_000n,
      ingestedAt: 200_000n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 2,
    maxLateArrivalMs: 30_000n,
    watermark,
    strict: false,
  }))

  assert.deepEqual(seenWatermarkInputs, ["evt-1", "evt-2"])
  assert.equal(batches[0]?.watermark, 170_000n)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-1", "evt-2"],
  )
})

test("orderEventStream treats equality with the active watermark as ready but not late", async () => {
  async function* source() {
    yield makeEvent({
      id: "evt-progress",
      physicalTimeMs: 200_000n,
      ingestedAt: 200_000n,
    })
    yield makeEvent({
      id: "evt-boundary",
      physicalTimeMs: 170_000n,
      ingestedAt: 170_000n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 10,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "flag",
    watermark: (event) => event.ingestedAt,
    strict: false,
  }))

  assert.ok(
    batches.every((batch) =>
      batch.anomalies.every((anomaly) => anomaly.type !== "late_arrival"),
    ),
  )
  assert.equal(batches[0]?.watermark, 170_000n)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-boundary"],
  )
  assert.deepEqual(
    batches[1]?.events.map((entry) => entry.event.id),
    ["evt-progress"],
  )
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
    /Watermark function/,
  )
})
