import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("orderEvents marks parent-child evidence as proven and machine-readable", () => {
  const parent = makeEvent({
    id: "evt-parent",
    nodeId: "node-a",
    sequence: 1n,
    physicalTimeMs: 1_000n,
  })
  const child = makeEvent({
    id: "evt-child",
    nodeId: "node-b",
    parentEventId: "evt-parent",
    physicalTimeMs: 1_100n,
  })

  const result = orderEvents([child, parent])
  const orderedChild = result.ordered.find((entry) => entry.event.id === "evt-child")

  assert.ok(orderedChild)
  assert.equal(orderedChild.confidence, "proven")
  assert.equal(orderedChild.orderBasis, "causal")
  assert.deepEqual(orderedChild.causalEvidence, [
    { type: "parent_event", parentEventId: "evt-parent" },
  ])
})

test("orderEvents keeps HLC-only ordering as derived", () => {
  const event = makeEvent({
    id: "evt-hlc",
    nodeId: "node-a",
    physicalTimeMs: 5_000n,
  })

  const result = orderEvents([event])

  assert.equal(result.ordered[0].orderBasis, "hlc")
  assert.equal(result.ordered[0].confidence, "derived")
})

test("orderEvents returns structured anomalies by default for invalid input", () => {
  const invalid = {
    id: "evt-invalid",
    nodeId: "node-a",
    clock: {
      physicalTimeMs: -100n,
      logicalCounter: 0,
      nodeId: "node-a",
    },
    payload: {},
  }

  const result = orderEvents([invalid], { strict: false })

  assert.equal(result.ordered.length, 0)
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))
})

test("orderEvents throws in strict mode when input is invalid", () => {
  const invalid = {
    id: "evt-invalid",
    nodeId: "node-a",
    clock: {
      physicalTimeMs: -100n,
      logicalCounter: 0,
      nodeId: "node-a",
    },
    payload: {},
  }

  assert.throws(() => orderEvents([invalid], { strict: true }), /Invalid event/)
})
