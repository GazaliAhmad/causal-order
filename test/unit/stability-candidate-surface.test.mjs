import assert from "node:assert/strict"

import {
  compareByHlc,
  compareClocks,
  compareDeterministically,
  compareWithTieBreaker,
  orderEvents,
} from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("compatibility HLC alias stays behaviorally aligned with compareByHlc", () => {
  const earlier = makeEvent({
    id: "evt-1",
    nodeId: "node-a",
    physicalTimeMs: 1_000n,
    logicalCounter: 0,
  })
  const later = makeEvent({
    id: "evt-2",
    nodeId: "node-b",
    physicalTimeMs: 1_005n,
    logicalCounter: 1,
  })

  assert.equal(
    compareClocks(earlier.clock, later.clock),
    compareByHlc(earlier.clock, later.clock),
  )
})

test("compatibility deterministic alias stays behaviorally aligned with compareDeterministically", () => {
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "node-a",
    physicalTimeMs: 1_000n,
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "node-b",
    physicalTimeMs: 1_000n,
  })

  assert.equal(
    compareWithTieBreaker(eventA, eventB, "event_id"),
    compareDeterministically(eventA, eventB, "event_id"),
  )
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
