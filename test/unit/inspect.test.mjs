import assert from "node:assert/strict"

import {
  explainOrderedEvent,
  inspectOrderBatch,
  inspectOrderResult,
  orderEvents,
  summarizeEventAnomalies,
  summarizeTranslationAnomalies,
  translateBatch,
} from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("summarizeEventAnomalies groups event anomalies by type and severity", () => {
  const event = makeEvent({ id: "evt-a" })
  const anomalies = [
    {
      type: "duplicate_event",
      severity: "warning",
      event,
      relatedEvents: [event],
      message: "duplicate detected",
    },
    {
      type: "duplicate_event",
      severity: "warning",
      event,
      relatedEvents: [event],
      message: "duplicate detected again",
    },
    {
      type: "late_arrival",
      severity: "info",
      event,
      relatedEvents: [],
      message: "late arrival detected",
    },
  ]

  const summary = summarizeEventAnomalies(anomalies)

  assert.equal(summary.total, 3)
  assert.deepEqual(summary.byType, {
    duplicate_event: 2,
    late_arrival: 1,
  })
  assert.deepEqual(summary.bySeverity, {
    warning: 2,
    info: 1,
  })
})

test("summarizeTranslationAnomalies groups translation anomalies by code, field, stage, mapper, and policy action", () => {
  const records = [
    { id: "evt-a", node: "node-a", time: "1000.5" },
    { id: "evt-b", node: "node-b", time: "1001", sequence: null },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getSequence: (record) => record.sequence,
    policy: {
      optionalFieldFailure: "continue",
    },
  })

  const summary = summarizeTranslationAnomalies(result.anomalies)

  assert.equal(summary.total, 2)
  assert.deepEqual(summary.byCode, {
    invalid_mapped_value: 2,
  })
  assert.deepEqual(summary.byField, {
    physical_time: 1,
    sequence: 1,
  })
  assert.deepEqual(summary.byStage, {
    field_validation: 1,
    timestamp_coercion: 1,
  })
  assert.deepEqual(summary.byMapper, {
    getPhysicalTime: 1,
    getSequence: 1,
  })
  assert.deepEqual(summary.byPolicyAction, {
    warn: 1,
    continue: 1,
  })
})

test("explainOrderedEvent produces deterministic human-readable reasoning without mutating the source entry", () => {
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

  const originalEvidence = orderedChild.causalEvidence
  const explanation = explainOrderedEvent(orderedChild)

  assert.equal(explanation.eventId, "evt-child")
  assert.equal(explanation.orderBasis, "causal")
  assert.equal(explanation.confidence, "proven")
  assert.match(explanation.summary, /event evt-child ordered at index \d+/)
  assert.match(explanation.summary, /causal ordering/)
  assert.match(explanation.summary, /proven confidence/)
  assert.match(explanation.summary, /parent_event\(evt-parent\)/)
  assert.strictEqual(orderedChild.causalEvidence, originalEvidence)
})

test("inspectOrderResult returns compact operational inspection output with order and anomaly counts", () => {
  const earlier = makeEvent({
    id: "evt-earlier",
    nodeId: "node-a",
    physicalTimeMs: 1_000n,
    sequence: 1n,
  })
  const later = makeEvent({
    id: "evt-later",
    nodeId: "node-b",
    physicalTimeMs: 2_000n,
    sequence: 1n,
  })
  const invalid = {
    id: "evt-invalid",
    nodeId: "node-c",
    clock: {
      physicalTimeMs: 10,
      logicalCounter: 0,
      nodeId: "node-c",
    },
    sequence: 1n,
    payload: {},
  }

  const result = orderEvents([later, invalid, earlier], { strict: false })
  const before = result.ordered.map((entry) => ({
    id: entry.event.id,
    orderBasis: entry.orderBasis,
    confidence: entry.confidence,
    evidence: entry.causalEvidence?.map((item) => item.type) ?? [],
  }))

  const inspection = inspectOrderResult(result)
  const after = result.ordered.map((entry) => ({
    id: entry.event.id,
    orderBasis: entry.orderBasis,
    confidence: entry.confidence,
    evidence: entry.causalEvidence?.map((item) => item.type) ?? [],
  }))

  assert.deepEqual(after, before)
  assert.equal(inspection.stats.totalEvents, 3)
  assert.deepEqual(inspection.counts.byOrderBasis, { sequence: 2 })
  assert.deepEqual(inspection.counts.byConfidence, { derived: 2 })
  assert.equal(inspection.anomalySummary.total, result.anomalies.length)
  assert.equal(inspection.anomalySummary.byType.invalid_clock, 1)
  assert.deepEqual(
    inspection.ordered.map((entry) => ({
      eventId: entry.eventId,
      orderBasis: entry.orderBasis,
      confidence: entry.confidence,
    })),
    [
      { eventId: "evt-earlier", orderBasis: "sequence", confidence: "derived" },
      { eventId: "evt-later", orderBasis: "sequence", confidence: "derived" },
    ],
  )
  assert.equal(inspection.anomalies[0]?.eventId, "evt-invalid")
  assert.equal(inspection.anomalies[0]?.type, "invalid_clock")
})

test("inspectOrderBatch exposes emitted batch visibility without hiding correction metadata", () => {
  const baseResult = orderEvents([
    makeEvent({
      id: "evt-a",
      nodeId: "node-a",
      physicalTimeMs: 1_000n,
    }),
    makeEvent({
      id: "evt-b",
      nodeId: "node-b",
      physicalTimeMs: 1_500n,
    }),
  ])

  const batch = {
    events: baseResult.ordered,
    anomalies: [
      {
        type: "late_arrival",
        severity: "info",
        event: makeEvent({
          id: "evt-late",
          nodeId: "node-c",
          physicalTimeMs: 500n,
        }),
        relatedEvents: [],
        message: "late arrival triggered correction-capable output",
      },
    ],
    watermark: 1_400n,
    anomalyHorizon: {
      retainedEventHistory: "buffered_window_only",
      crossWindowRelationalDetection: "late_arrival_only",
    },
    correction: {
      reason: "late_arrival",
      scope: "all_non_final_output",
      triggerEventId: "evt-late",
    },
    isFinal: false,
  }

  const inspection = inspectOrderBatch(batch)

  assert.equal(inspection.watermark, 1_400n)
  assert.equal(inspection.isFinal, false)
  assert.deepEqual(inspection.counts.byOrderBasis, { hlc: 2 })
  assert.deepEqual(inspection.counts.byConfidence, { derived: 2 })
  assert.equal(inspection.anomalySummary.total, 1)
  assert.deepEqual(inspection.anomalySummary.byType, { late_arrival: 1 })
  assert.equal(inspection.correction?.triggerEventId, "evt-late")
  assert.equal(inspection.events[0]?.eventId, "evt-a")
  assert.match(inspection.events[0]?.summary ?? "", /HLC ordering/)
})
