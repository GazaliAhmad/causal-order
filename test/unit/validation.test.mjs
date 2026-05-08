import assert from "node:assert/strict"

import {
  compareByCausality,
  validateClock,
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

test("validateEvent accepts raw unknown input and returns a validated value on success", () => {
  const raw = {
    id: "evt-valid",
    nodeId: "node-a",
    clock: {
      physicalTimeMs: 1_000n,
      logicalCounter: 0,
      nodeId: "node-a",
    },
    payload: { type: "test" },
    sequence: 1n,
  }

  const result = validateEvent(raw)

  assert.equal(result.valid, true)
  assert.equal(result.value.id, "evt-valid")
  assert.equal(result.value.clock.nodeId, "node-a")
})

test("validateClock accepts raw unknown input and returns a validated value on success", () => {
  const raw = {
    physicalTimeMs: 1_000n,
    logicalCounter: 0,
    nodeId: "node-a",
  }

  const result = validateClock(raw)

  assert.equal(result.valid, true)
  assert.equal(result.value.physicalTimeMs, 1_000n)
  assert.equal(result.value.nodeId, "node-a")
})

test("compareByCausality returns unknown for valid independent cross-node events without explicit evidence", () => {
  const a = makeEvent({ id: "evt-a", nodeId: "node-a" })
  const b = makeEvent({ id: "evt-b", nodeId: "node-b", physicalTimeMs: 1_001n })

  assert.equal(compareByCausality(a, b), "unknown")
})

test("compareByCausality still orders same-node events by monotonic sequence", () => {
  const a = makeEvent({ id: "evt-a", nodeId: "node-a", sequence: 1n })
  const b = makeEvent({ id: "evt-b", nodeId: "node-a", sequence: 2n, physicalTimeMs: 1_001n })

  assert.equal(compareByCausality(a, b), "before")
  assert.equal(compareByCausality(b, a), "after")
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
