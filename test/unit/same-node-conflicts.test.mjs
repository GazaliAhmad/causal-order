import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("orderEvents reports same-node sequence conflicts for duplicate sequence numbers", () => {
  const events = [
    makeEvent({
      id: "evt-a",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_001n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.ok(result.anomalies.some((anomaly) =>
    anomaly.type === "same_node_sequence_conflict" &&
    anomaly.event?.id === "evt-b",
  ))
})

test("orderEvents keeps same-node conflicts visible without inventing causal proof", () => {
  const events = [
    makeEvent({
      id: "evt-a",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_001n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.ok(result.anomalies.some((anomaly) =>
    anomaly.type === "same_node_sequence_conflict" &&
    anomaly.event?.id === "evt-b",
  ))
  assert.ok(result.ordered.every((entry) => entry.confidence !== "proven"))
  assert.ok(result.ordered.every((entry) => entry.causalEvidence === undefined))
})

test("orderEvents reports same-node sequence regressions when arrival order goes backward", () => {
  const events = [
    makeEvent({
      id: "evt-2",
      nodeId: "node-a",
      sequence: 2n,
      physicalTimeMs: 1_100n,
    }),
    makeEvent({
      id: "evt-1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.ok(result.anomalies.some((anomaly) =>
    anomaly.type === "sequence_regression" &&
    anomaly.event?.id === "evt-1",
  ))
  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-1", "evt-2"],
  )
})

test("orderEvents survives mixed valid and invalid same-node histories in non-strict mode", () => {
  const events = [
    makeEvent({
      id: "evt-1",
      nodeId: "node-a",
      sequence: 1n,
      physicalTimeMs: 1_000n,
    }),
    {
      id: "evt-invalid",
      nodeId: "node-a",
      clock: {
        physicalTimeMs: 1_100n,
        logicalCounter: -1,
        nodeId: "node-a",
      },
      payload: {},
      sequence: 2n,
    },
    makeEvent({
      id: "evt-3",
      nodeId: "node-a",
      sequence: 3n,
      physicalTimeMs: 1_200n,
    }),
  ]

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-1", "evt-3"],
  )
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))
})
