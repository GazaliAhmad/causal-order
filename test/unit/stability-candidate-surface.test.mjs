import assert from "node:assert/strict"

import {
  compareByHlc,
  orderEvents,
  orderValidatedEvents,
} from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"
import { validateEvent } from "../../dist/validate.js"

test("root surface keeps the stable primary comparison helpers only", async () => {
  const rootSurface = await import("../../dist/index.js")

  assert.equal(typeof rootSurface.compareByHlc, "function")
  assert.equal(typeof rootSurface.compareDeterministically, "function")
  assert.equal("compareClocks" in rootSurface, false)
  assert.equal("compareWithTieBreaker" in rootSurface, false)
})

test("allowUnknownOrder false strengthens unresolved severity without changing emitted ordering", () => {
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "node-a",
    dependencyEventIds: ["evt-c"],
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "node-b",
    dependencyEventIds: ["evt-a"],
  })
  const eventC = makeEvent({
    id: "evt-c",
    nodeId: "node-c",
    dependencyEventIds: ["evt-b"],
  })

  const visibleDefault = orderEvents([eventA, eventB, eventC], {
    strict: false,
    detectAnomalies: true,
  })
  const governed = orderEvents([eventA, eventB, eventC], {
    strict: false,
    detectAnomalies: true,
    allowUnknownOrder: false,
  })

  assert.deepEqual(
    governed.ordered.map((entry) => ({
      id: entry.event.id,
      confidence: entry.confidence,
      orderBasis: entry.orderBasis,
    })),
    visibleDefault.ordered.map((entry) => ({
      id: entry.event.id,
      confidence: entry.confidence,
      orderBasis: entry.orderBasis,
    })),
  )
  assert.equal(
    visibleDefault.anomalies.filter((anomaly) => anomaly.type === "unknown_order").every((anomaly) => anomaly.severity === "warning"),
    true,
  )
  assert.equal(
    governed.anomalies.filter((anomaly) => anomaly.type === "unknown_order").every((anomaly) => anomaly.severity === "error"),
    true,
  )
})

test("detectAnomalies false reduces emitted anomaly analysis without upgrading ordering confidence", () => {
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "node-a",
    dependencyEventIds: ["evt-c"],
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "node-b",
    dependencyEventIds: ["evt-a"],
  })
  const eventC = makeEvent({
    id: "evt-c",
    nodeId: "node-c",
    dependencyEventIds: ["evt-b"],
  })

  const withAnomalies = orderEvents([eventA, eventB, eventC], {
    strict: false,
    detectAnomalies: true,
  })
  const withoutAnomalies = orderEvents([eventA, eventB, eventC], {
    strict: false,
    detectAnomalies: false,
  })

  assert.deepEqual(
    withoutAnomalies.ordered.map((entry) => ({
      id: entry.event.id,
      confidence: entry.confidence,
      orderBasis: entry.orderBasis,
    })),
    withAnomalies.ordered.map((entry) => ({
      id: entry.event.id,
      confidence: entry.confidence,
      orderBasis: entry.orderBasis,
    })),
  )
  assert.ok(withAnomalies.anomalies.length > withoutAnomalies.anomalies.length)
  assert.ok(withoutAnomalies.ordered.every((entry) => entry.confidence === "unknown"))
})

test("orderValidatedEvents keeps anomaly visibility on by default without exposing the old internal bag", () => {
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "node-a",
    physicalTimeMs: 1_000n,
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "node-b",
    physicalTimeMs: 1_001n,
  })

  const validated = [eventA, eventB].map((event) => {
    const validation = validateEvent(event, { includeWarnings: false })
    assert.equal(validation.valid, true)
    return validation.value
  })

  const withAnomalies = orderValidatedEvents(validated, {
    detectAnomalies: true,
  })
  const withoutAnomalies = orderValidatedEvents(validated, {
    detectAnomalies: false,
  })

  assert.equal(withAnomalies.stats.invalidEvents, 0)
  assert.ok(withAnomalies.anomalies.length > withoutAnomalies.anomalies.length)
  assert.deepEqual(
    withoutAnomalies.ordered.map((entry) => ({
      id: entry.event.id,
      confidence: entry.confidence,
      orderBasis: entry.orderBasis,
    })),
    withAnomalies.ordered.map((entry) => ({
      id: entry.event.id,
      confidence: entry.confidence,
      orderBasis: entry.orderBasis,
    })),
  )
})
