import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("orderEvents keeps events with missing parent references and does not invent causal evidence", () => {
  const child = makeEvent({
    id: "evt-child",
    nodeId: "node-a",
    sequence: 2n,
    parentEventId: "evt-missing-parent",
    physicalTimeMs: 1_100n,
  })
  const sibling = makeEvent({
    id: "evt-sibling",
    nodeId: "node-a",
    sequence: 1n,
    physicalTimeMs: 1_000n,
  })

  const result = orderEvents([child, sibling], {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-sibling", "evt-child"],
  )

  const orderedChild = result.ordered.find((entry) => entry.event.id === "evt-child")
  assert.ok(orderedChild)
  assert.equal(orderedChild.orderBasis, "sequence")
  assert.equal(orderedChild.confidence, "proven")
  assert.deepEqual(orderedChild.causalEvidence, [
    { type: "same_node_sequence" },
  ])
})

test("orderEvents ignores missing dependency references while preserving present dependencies", () => {
  const dependency = makeEvent({
    id: "evt-dependency",
    nodeId: "node-a",
    physicalTimeMs: 1_000n,
  })
  const event = makeEvent({
    id: "evt-target",
    nodeId: "node-b",
    dependencyEventIds: ["evt-dependency", "evt-missing"],
    physicalTimeMs: 1_100n,
  })

  const result = orderEvents([event, dependency], {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-dependency", "evt-target"],
  )

  const orderedTarget = result.ordered.find((entry) => entry.event.id === "evt-target")
  assert.ok(orderedTarget)
  assert.equal(orderedTarget.orderBasis, "causal")
  assert.equal(orderedTarget.confidence, "proven")
  assert.deepEqual(orderedTarget.causalEvidence, [
    { type: "causal_dependency", dependsOnEventId: "evt-dependency" },
  ])
})
