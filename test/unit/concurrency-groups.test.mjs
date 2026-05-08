import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("orderEvents does not label independent cross-node runs as concurrent without explicit evidence", () => {
  const events = [
    makeEvent({
      id: "evt-a1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b1",
      nodeId: "node-b",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-c1",
      nodeId: "node-c",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-a2",
      nodeId: "node-a",
      sequence: 2n,
      physicalTimeMs: 1_100n,
    }),
    makeEvent({
      id: "evt-b2",
      nodeId: "node-b",
      sequence: 2n,
      physicalTimeMs: 1_100n,
    }),
    makeEvent({
      id: "evt-c2",
      nodeId: "node-c",
      sequence: 2n,
      physicalTimeMs: 1_100n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(result.concurrentGroups, [])
})

test("orderEvents keeps groups empty when adjacency alone is the only cross-node signal", () => {
  const events = [
    makeEvent({
      id: "evt-a1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b1",
      nodeId: "node-b",
      sequence: 1n,
      physicalTimeMs: 1_000n,
      dependencyEventIds: ["evt-a1"],
    }),
    makeEvent({
      id: "evt-c1",
      nodeId: "node-c",
      sequence: 3n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b2",
      nodeId: "node-b",
      sequence: 2n,
      physicalTimeMs: 1_000n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(result.concurrentGroups, [])
  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-a1", "evt-b1", "evt-b2", "evt-c1"],
  )
})

test("orderEvents keeps causally constrained tails out of concurrent groups when the remainder is still unknown", () => {
  const events = [
    makeEvent({
      id: "evt-a1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b1",
      nodeId: "node-b",
      sequence: 1n,
      physicalTimeMs: 1_000n,
      dependencyEventIds: ["evt-a1"],
    }),
    makeEvent({
      id: "evt-c1",
      nodeId: "node-c",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(result.concurrentGroups, [])
  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-a1", "evt-b1", "evt-c1"],
  )
})
