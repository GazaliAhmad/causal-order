import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { offlineSyncAnomaliesFixture } from "../fixtures/offline-sync-anomalies.mjs"
import { replayCorruptionFixture } from "../fixtures/replay-corruption.mjs"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

function summarizeOrdered(result) {
  return result.ordered.map((entry) => ({
    id: entry.event.id,
    nodeId: entry.event.nodeId,
    orderIndex: entry.orderIndex.toString(),
    orderBasis: entry.orderBasis,
    confidence: entry.confidence,
    causalEvidence: entry.causalEvidence,
  }))
}

function summarizeAnomalies(result) {
  return result.anomalies.map((anomaly) => ({
    type: anomaly.type,
    severity: anomaly.severity,
    eventId: anomaly.event?.id,
    relatedEventIds: anomaly.relatedEvents?.map((event) => event.id),
    message: anomaly.message,
  }))
}

function countAnomaliesByType(result) {
  const counts = new Map()

  for (const anomaly of result.anomalies) {
    counts.set(anomaly.type, (counts.get(anomaly.type) ?? 0) + 1)
  }

  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function createShuffledCopy(events, order) {
  return order.map((index) => events[index])
}

function assertRepeatedInputDeterminism(events, options) {
  const first = orderEvents(events, options)
  const second = orderEvents(events, options)

  assert.deepEqual(summarizeOrdered(first), summarizeOrdered(second))
  assert.deepEqual(summarizeAnomalies(first), summarizeAnomalies(second))
  assert.deepEqual(first.stats, second.stats)
}

function assertStableShuffledConclusions(events, options, summarizeConclusions, shuffles) {
  const baseline = summarizeConclusions(orderEvents(events, options))

  for (const order of shuffles) {
    const shuffled = createShuffledCopy(events, order)
    const result = summarizeConclusions(orderEvents(shuffled, options))
    assert.deepEqual(result, baseline)
  }
}

function createDuplicateStormEvents() {
  const fixture = replayCorruptionFixture()
  const duplicates = [
    fixture.original,
    fixture.replayedOriginal,
    makeEvent({
      id: "order-created-1",
      nodeId: "replay-job-2",
      physicalTimeMs: 1_600n,
      payload: { type: "order.created.replayed" },
      ingestedAt: 2_100n,
    }),
    makeEvent({
      id: "order-created-1",
      nodeId: "replay-job-3",
      physicalTimeMs: 1_700n,
      payload: { type: "order.created.replayed" },
      ingestedAt: 2_200n,
    }),
    makeEvent({
      id: "order-created-1",
      nodeId: "replay-job-4",
      physicalTimeMs: 1_800n,
      payload: { type: "order.created.replayed" },
      ingestedAt: 2_300n,
    }),
  ]

  return [
    fixture.paymentCaptured,
    duplicates[3],
    duplicates[1],
    duplicates[4],
    duplicates[0],
    duplicates[2],
  ]
}

function createClockResetEvents() {
  return [
    makeEvent({
      id: "pre-reset-40",
      nodeId: "device-1",
      physicalTimeMs: 4_000n,
      sequence: 40n,
    }),
    makeEvent({
      id: "pre-reset-41",
      nodeId: "device-1",
      physicalTimeMs: 4_100n,
      sequence: 41n,
    }),
    makeEvent({
      id: "post-reset-1",
      nodeId: "device-1",
      physicalTimeMs: 100n,
      sequence: 1n,
    }),
    makeEvent({
      id: "post-reset-2",
      nodeId: "device-1",
      physicalTimeMs: 200n,
      sequence: 2n,
    }),
  ]
}

function createMassiveReplayEvents(totalEvents = 120) {
  const events = []

  for (let index = totalEvents; index >= 1; index -= 1) {
    events.push(makeEvent({
      id: `replay-${String(index).padStart(3, "0")}`,
      nodeId: "replay-device",
      physicalTimeMs: BigInt(index * 100),
      sequence: BigInt(index),
      payload: { type: "replay.event", index },
    }))
  }

  return events
}

function createPartialLogCorruptionEvents() {
  return [
    makeEvent({
      id: "evt-2",
      nodeId: "node-a",
      sequence: 2n,
      physicalTimeMs: 1_020n,
      dependencyEventIds: ["evt-1", "evt-missing"],
    }),
    {
      id: "evt-invalid",
      nodeId: "node-c",
      clock: {
        physicalTimeMs: -1n,
        logicalCounter: 0,
        nodeId: "node-c",
      },
      payload: {},
    },
    makeEvent({
      id: "evt-1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-1",
      nodeId: "node-b",
      sequence: 1n,
      physicalTimeMs: 1_005n,
    }),
    makeEvent({
      id: "evt-missing-sequence",
      nodeId: "node-d",
      physicalTimeMs: 1_010n,
      parentEventId: "evt-not-present",
    }),
  ]
}

const DEFAULT_OPTIONS = {
  strict: false,
  detectAnomalies: true,
}

test("0.3.2 release-gate missing-parent case stays deterministic and keeps same-node conclusions under shuffled arrival", () => {
  const events = [
    makeEvent({
      id: "evt-child",
      nodeId: "node-a",
      sequence: 2n,
      parentEventId: "evt-missing-parent",
      physicalTimeMs: 1_100n,
    }),
    makeEvent({
      id: "evt-sibling",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
  ]

  assertRepeatedInputDeterminism(events, DEFAULT_OPTIONS)

  const result = orderEvents(events, DEFAULT_OPTIONS)
  const orderedChild = result.ordered.find((entry) => entry.event.id === "evt-child")
  assert.ok(orderedChild)
  assert.equal(orderedChild.orderBasis, "sequence")
  assert.equal(orderedChild.confidence, "proven")
  assert.deepEqual(orderedChild.causalEvidence, [
    { type: "same_node_sequence" },
  ])

  assertStableShuffledConclusions(
    events,
    DEFAULT_OPTIONS,
    (current) => summarizeOrdered(current),
    [[1, 0]],
  )
})

test("0.3.2 release-gate offline-device-merge case stays deterministic and preserves device history under shuffled arrival", () => {
  const { events } = offlineSyncAnomaliesFixture()

  assertRepeatedInputDeterminism(events, DEFAULT_OPTIONS)

  const result = orderEvents(events, DEFAULT_OPTIONS)
  const deviceEntries = result.ordered.filter((entry) => entry.event.nodeId === "device-1")
  assert.deepEqual(
    deviceEntries.map((entry) => entry.event.id),
    ["draft-created", "draft-edited", "draft-submitted"],
  )
  assert.ok(deviceEntries.slice(1).every((entry) => entry.confidence === "proven"))

  assertStableShuffledConclusions(
    events,
    DEFAULT_OPTIONS,
    (current) => summarizeOrdered(current),
    [
      [3, 0, 1, 2],
      [1, 2, 3, 0],
    ],
  )
})

test("0.3.2 release-gate duplicate-storm case stays deterministic and keeps duplicate visibility under shuffled arrival", () => {
  const events = createDuplicateStormEvents()

  assertRepeatedInputDeterminism(events, DEFAULT_OPTIONS)

  const result = orderEvents(events, DEFAULT_OPTIONS)
  assert.equal(result.ordered.length, events.length)
  assert.equal(
    result.anomalies.filter((anomaly) => anomaly.type === "duplicate_event").length,
    4,
  )
  assert.ok(result.ordered.some((entry) => entry.event.id === "payment-captured-1"))

  assertStableShuffledConclusions(
    events,
    DEFAULT_OPTIONS,
    (current) => ({
      orderedNodeIds: current.ordered.map((entry) => entry.event.nodeId).sort(),
      duplicateCount: current.anomalies.filter((anomaly) => anomaly.type === "duplicate_event").length,
      paymentCapturedIncluded: current.ordered.some((entry) => entry.event.id === "payment-captured-1"),
    }),
    [
      [4, 0, 1, 5, 3, 2],
      [2, 4, 0, 5, 1, 3],
    ],
  )
})

test("0.3.2 release-gate clock-reset case stays deterministic and keeps ordered conclusions under shuffled arrival", () => {
  const events = createClockResetEvents()

  assertRepeatedInputDeterminism(events, DEFAULT_OPTIONS)

  const result = orderEvents(events, DEFAULT_OPTIONS)
  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["post-reset-1", "post-reset-2", "pre-reset-40", "pre-reset-41"],
  )
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "sequence_regression"))

  assertStableShuffledConclusions(
    events,
    DEFAULT_OPTIONS,
    (current) => summarizeOrdered(current),
    [
      [2, 3, 0, 1],
      [0, 2, 1, 3],
    ],
  )
})

test("0.3.2 release-gate massive out-of-order replay case stays deterministic and restores the same ordered history", () => {
  const events = createMassiveReplayEvents()

  assertRepeatedInputDeterminism(events, DEFAULT_OPTIONS)

  const result = orderEvents(events, DEFAULT_OPTIONS)
  assert.equal(result.ordered.length, 120)
  assert.equal(result.ordered[0]?.event.id, "replay-001")
  assert.equal(result.ordered[result.ordered.length - 1]?.event.id, "replay-120")
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "sequence_regression"))

  assertStableShuffledConclusions(
    events,
    DEFAULT_OPTIONS,
    (current) => ({
      first: current.ordered[0]?.event.id,
      last: current.ordered[current.ordered.length - 1]?.event.id,
      orderedIds: current.ordered.map((entry) => entry.event.id),
    }),
    [
      [...Array.from({ length: events.length }, (_, index) => index)].reverse(),
      [...Array.from({ length: events.length }, (_, index) => (index * 17) % events.length)],
    ],
  )
})

test("0.3.2 release-gate partial-log-corruption case stays deterministic and preserves the same valid ordered history", () => {
  const events = createPartialLogCorruptionEvents()

  assertRepeatedInputDeterminism(events, DEFAULT_OPTIONS)

  const result = orderEvents(events, DEFAULT_OPTIONS)
  assert.equal(result.stats.totalEvents, 5)
  assert.equal(result.stats.validEvents, 4)
  assert.equal(result.stats.invalidEvents, 1)
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"))
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "missing_sequence"))

  assertStableShuffledConclusions(
    events,
    DEFAULT_OPTIONS,
    (current) => ({
      ordered: current.ordered.map((entry) => entry.event.id),
      validEvents: current.stats.validEvents,
      invalidEvents: current.stats.invalidEvents,
      requiredAnomalyTypes: [...new Set(
        current.anomalies
          .filter((anomaly) =>
            anomaly.type === "invalid_clock" ||
            anomaly.type === "duplicate_event" ||
            anomaly.type === "missing_sequence",
          )
          .map((anomaly) => anomaly.type),
      )].sort(),
    }),
    [
      [2, 0, 4, 1, 3],
      [1, 3, 4, 0, 2],
    ],
  )
})
