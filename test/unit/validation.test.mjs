import assert from "node:assert/strict"

import {
  compareByCausality,
  validateEvent,
} from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("validateEvent reports invalid clocks and missing sequence warnings", () => {
  const result = validateEvent({
    id: "evt-invalid",
    nodeId: "node-a",
    clock: {
      physicalTimeMs: -1n,
      logicalCounter: -1,
      nodeId: "",
    },
    payload: {},
  })

  assert.equal(result.valid, false)
  assert.ok(result.errors.some((error) => error.code === "invalid_physical_time"))
  assert.ok(result.errors.some((error) => error.code === "invalid_logical_counter"))
  assert.ok(result.errors.some((error) => error.code === "missing_node_id"))
  assert.ok(result.warnings.some((warning) => warning.code === "missing_sequence"))
})

test("compareByCausality returns concurrent for valid independent cross-node events", () => {
  const a = makeEvent({ id: "evt-a", nodeId: "node-a" })
  const b = makeEvent({ id: "evt-b", nodeId: "node-b", physicalTimeMs: 1_001n })

  assert.equal(compareByCausality(a, b), "concurrent")
})

test("compareByCausality returns unknown when metadata is invalid", () => {
  const a = makeEvent({ id: "evt-a" })
  const b = makeEvent({
    id: "evt-b",
    nodeId: "",
    clock: {
      physicalTimeMs: 1_001n,
      logicalCounter: 0,
      nodeId: "",
    },
  })

  assert.equal(compareByCausality(a, b), "unknown")
})
