import assert from "node:assert/strict"

import {
  ingestedAtWatermark,
  orderEventStream,
} from "../../dist/index.js"
import { collectAsync, makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

function nonEmptyBatches(batches) {
  return batches.filter((batch) => batch.events.length > 0 || batch.anomalies.length > 0)
}

test("0.3.2 release-gate pathological late-arrival pressure keeps every late event visible", async () => {
  async function* source() {
    yield makeEvent({
      id: "progress-1",
      nodeId: "server-a",
      physicalTimeMs: 100_000n,
      ingestedAt: 100_000n,
    })
    yield makeEvent({
      id: "progress-2",
      nodeId: "server-b",
      physicalTimeMs: 160_000n,
      ingestedAt: 160_000n,
    })
    yield makeEvent({
      id: "late-1",
      nodeId: "device-1",
      physicalTimeMs: 100_100n,
      sequence: 1n,
      ingestedAt: 200_000n,
    })
    yield makeEvent({
      id: "late-2",
      nodeId: "device-1",
      physicalTimeMs: 100_200n,
      sequence: 2n,
      ingestedAt: 200_100n,
    })
    yield makeEvent({
      id: "late-3",
      nodeId: "device-1",
      physicalTimeMs: 100_300n,
      sequence: 3n,
      ingestedAt: 200_200n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 50,
    maxLateArrivalMs: 30_000n,
    lateArrivalPolicy: "flag",
    watermark: ingestedAtWatermark,
    strict: false,
  }))

  const lateAnomalies = batches.flatMap((batch) =>
    batch.anomalies.filter((anomaly) => anomaly.type === "late_arrival"),
  )
  const lateEntries = batches
    .flatMap((batch) => batch.events)
    .filter((entry) => entry.event.nodeId === "device-1")

  assert.equal(lateAnomalies.length, 3)
  assert.deepEqual(
    lateEntries.map((entry) => entry.event.id),
    ["late-1", "late-2", "late-3"],
  )
  assert.ok(lateEntries.every((entry) => entry.orderBasis === "sequence"))
})

test("0.3.2 release-gate reconnect-correction pressure keeps correction notices stable under repeated late arrivals", async () => {
  async function* source() {
    yield makeEvent({
      id: "review-started",
      nodeId: "server-review",
      physicalTimeMs: 19_500n,
      ingestedAt: 19_500n,
    })
    yield makeEvent({
      id: "notification-sent",
      nodeId: "server-notify",
      physicalTimeMs: 19_700n,
      ingestedAt: 19_700n,
    })

    for (let index = 1; index <= 5; index += 1) {
      yield makeEvent({
        id: `draft-${index}`,
        nodeId: "device-1",
        physicalTimeMs: 5_000n + BigInt(index * 100),
        sequence: BigInt(index),
        parentEventId: index > 1 ? `draft-${index - 1}` : undefined,
        ingestedAt: 20_000n + BigInt(index * 100),
      })
    }
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 500n,
    lateArrivalPolicy: "emit_correction",
    watermark: ingestedAtWatermark,
    strict: false,
  }))

  const correctionBatches = batches.filter((batch) => batch.correction !== undefined)

  assert.equal(correctionBatches.length, 5)
  assert.deepEqual(
    correctionBatches.map((batch) => batch.correction?.triggerEventId),
    ["draft-1", "draft-2", "draft-3", "draft-4", "draft-5"],
  )
  assert.ok(correctionBatches.every((batch) => batch.correction?.reason === "late_arrival"))
  assert.ok(correctionBatches.every((batch) => batch.isFinal === false))
  assert.equal(batches.at(-1)?.isFinal, true)
})

test("0.3.2 release-gate watermark pressure allows buffered accumulation until progress advances honestly", async () => {
  async function* source() {
    yield makeEvent({
      id: "evt-1",
      physicalTimeMs: 100n,
      ingestedAt: 100n,
    })
    yield makeEvent({
      id: "evt-2",
      physicalTimeMs: 120n,
      ingestedAt: 100n,
    })
    yield makeEvent({
      id: "evt-3",
      physicalTimeMs: 140n,
      ingestedAt: 100n,
    })
    yield makeEvent({
      id: "evt-4",
      physicalTimeMs: 160n,
      ingestedAt: 220n,
    })
  }

  const batches = nonEmptyBatches(await collectAsync(orderEventStream(source(), {
    batchSize: 2,
    maxLateArrivalMs: 50n,
    watermark: (event) => event.ingestedAt,
    strict: false,
  })))

  assert.equal(batches.length, 1)
  assert.equal(batches[0]?.watermark, 170n)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-1", "evt-2", "evt-3", "evt-4"],
  )
})

test("0.3.2 release-gate lagging-watermark plus batchSize pressure flushes only the ready subset", async () => {
  async function* source() {
    yield makeEvent({
      id: "evt-1",
      physicalTimeMs: 100n,
      ingestedAt: 100n,
    })
    yield makeEvent({
      id: "evt-2",
      physicalTimeMs: 200n,
      ingestedAt: 100n,
    })
    yield makeEvent({
      id: "evt-3",
      physicalTimeMs: 300n,
      ingestedAt: 350n,
    })
    yield makeEvent({
      id: "evt-4",
      physicalTimeMs: 400n,
      ingestedAt: 550n,
    })
  }

  const allBatches = await collectAsync(orderEventStream(source(), {
    batchSize: 2,
    maxLateArrivalMs: 150n,
    watermark: (event) => event.ingestedAt,
    strict: false,
  }))
  const batches = nonEmptyBatches(allBatches)

  assert.equal(batches.length, 2)
  assert.equal(batches[0]?.isFinal, false)
  assert.deepEqual(
    batches[0]?.events.map((entry) => entry.event.id),
    ["evt-1", "evt-2"],
  )
  assert.deepEqual(
    batches[1]?.events.map((entry) => entry.event.id),
    ["evt-3", "evt-4"],
  )
  assert.equal(batches[1]?.isFinal, false)
  assert.equal(allBatches.at(-1)?.isFinal, true)
})

test("0.3.2 release-gate bounded-memory behavior keeps only late-arrival anomaly carry across emitted windows", async () => {
  async function* source() {
    yield makeEvent({
      id: "dup",
      nodeId: "node-a",
      physicalTimeMs: 100_000n,
      sequence: 1n,
    })
    yield makeEvent({
      id: "dup",
      nodeId: "node-b",
      physicalTimeMs: 200_000n,
    })
    yield makeEvent({
      id: "seq-5",
      nodeId: "node-c",
      physicalTimeMs: 300_000n,
      sequence: 5n,
    })
    yield makeEvent({
      id: "seq-4",
      nodeId: "node-c",
      physicalTimeMs: 400_000n,
      sequence: 4n,
    })
    yield makeEvent({
      id: "late-cross-window",
      nodeId: "node-d",
      physicalTimeMs: 150_000n,
      ingestedAt: 500_000n,
    })
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 1,
    maxLateArrivalMs: 0n,
    lateArrivalPolicy: "flag",
    strict: false,
  }))

  const anomalyTypes = batches.flatMap((batch) => batch.anomalies.map((anomaly) => anomaly.type))

  assert.equal(anomalyTypes.includes("duplicate_event"), false)
  assert.equal(anomalyTypes.includes("sequence_regression"), false)
  assert.equal(anomalyTypes.includes("late_arrival"), true)
  assert.deepEqual(batches[0]?.anomalyHorizon, {
    retainedEventHistory: "buffered_window_only",
    crossWindowRelationalDetection: "late_arrival_only",
  })
})
