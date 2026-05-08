import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { traceAndPartitionNoncausalFixture } from "../fixtures/trace-and-partition-noncausal.mjs"
import { test } from "../helpers/harness.mjs"

test("trace and partition fixture keeps shared metadata non-causal while honoring explicit parent edges", () => {
  const fixture = traceAndPartitionNoncausalFixture()
  const result = orderEvents(fixture.events, {
    getPartition: (event) => event.partition,
  })

  const inventoryChecked = result.ordered.find((entry) => entry.event.id === "inventory-checked")
  const paymentCaptured = result.ordered.find((entry) => entry.event.id === "payment-captured")

  assert.ok(inventoryChecked)
  assert.equal(inventoryChecked.confidence, "derived")
  assert.equal(inventoryChecked.orderBasis, "hlc")
  assert.equal(inventoryChecked.causalEvidence, undefined)

  assert.ok(paymentCaptured)
  assert.equal(paymentCaptured.confidence, "proven")
  assert.equal(paymentCaptured.orderBasis, "causal")
  assert.deepEqual(paymentCaptured.causalEvidence, [
    { type: "parent_event", parentEventId: "request-accepted" },
  ])

  assert.deepEqual(result.concurrentGroups, [])
})
