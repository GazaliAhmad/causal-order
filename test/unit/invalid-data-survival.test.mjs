import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("orderEvents survives messy mixed batches in non-strict mode", () => {
  const events = [
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
    {
      id: "evt-invalid",
      nodeId: "node-c",
      clock: {
        physicalTimeMs: 1_015n,
        logicalCounter: -1,
        nodeId: "node-c",
      },
      payload: {},
    },
    makeEvent({
      id: "evt-missing-sequence",
      nodeId: "node-d",
      physicalTimeMs: 1_010n,
      parentEventId: "evt-not-present",
    }),
    makeEvent({
      id: "evt-2",
      nodeId: "node-a",
      sequence: 2n,
      physicalTimeMs: 1_020n,
      dependencyEventIds: ["evt-1", "evt-ghost"],
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.equal(result.stats.totalEvents, 5)
  assert.equal(result.stats.validEvents, 4)
  assert.equal(result.stats.invalidEvents, 1)
  assert.ok(result.ordered.length >= 4)
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"))
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "missing_sequence"))
})

test("orderEvents fails fast on messy mixed batches in strict mode", () => {
  const events = [
    makeEvent({
      id: "evt-1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    {
      id: "evt-invalid",
      nodeId: "node-b",
      clock: {
        physicalTimeMs: 1_010n,
        logicalCounter: -1,
        nodeId: "node-b",
      },
      payload: {},
    },
    makeEvent({
      id: "evt-2",
      nodeId: "node-a",
      sequence: 2n,
      physicalTimeMs: 1_020n,
    }),
  ]

  assert.throws(
    () => orderEvents(events, { strict: true, detectAnomalies: true }),
    /Invalid event/,
  )
})
