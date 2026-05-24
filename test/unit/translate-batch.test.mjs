import assert from "node:assert/strict"

import { TranslateBatchPolicyError, orderEvents, translateBatch } from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"

test("translateBatch maps records through the public ingress surface", () => {
  const records = [
    {
      id: "evt-1",
      node: "node-a",
      time: 1_000n,
      seq: 1n,
    },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getSequence: (record) => record.seq,
  })

  assert.equal(result.translated.length, 1)
  assert.equal(result.anomalies.length, 0)
  assert.equal(result.translated[0]?.id, "evt-1")
  assert.equal(result.translated[0]?.clock.logicalCounter, 0)
  assert.equal(result.translated[0]?.payload, records[0])
})

test("translateBatch output can flow directly into orderEvents for raw-record ingress", () => {
  const records = [
    {
      eventId: "evt-1",
      source: "orders-api",
      occurredAt: "1714971840123",
      seq: 1n,
      body: { type: "order.created" },
    },
    {
      eventId: "evt-2",
      source: "payments-worker",
      occurredAt: 1714971840125,
      seq: 1n,
      parent: "evt-1",
      body: { type: "payment.captured" },
    },
  ]

  const translated = translateBatch(records, {
    getEventId: (record) => record.eventId,
    getNodeId: (record) => record.source,
    getPhysicalTime: (record) => record.occurredAt,
    getSequence: (record) => record.seq,
    getParentEventId: (record) => record.parent,
    getPayload: (record) => record.body,
  })

  assert.equal(translated.anomalies.length, 0)

  const result = orderEvents(translated.translated, {
    strict: false,
    detectAnomalies: true,
  })

  assert.equal(result.anomalies.length, 0)
  assert.deepEqual(
    result.ordered.map((item) => item.event.id),
    ["evt-1", "evt-2"],
  )
  assert.equal(result.ordered[0]?.orderBasis, "sequence")
  assert.equal(result.ordered[1]?.orderBasis, "causal")
})

test("translateBatch freezes the structural envelope but preserves payload by reference", () => {
  const payload = {
    type: "order.created",
    nested: {
      mutable: true,
    },
  }
  const dependencyEventIds = ["evt-0"]
  const records = [
    {
      id: "evt-1",
      node: "node-a",
      time: 1_000n,
      deps: dependencyEventIds,
      payload,
    },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getDependencyEventIds: (record) => record.deps,
    getPayload: (record) => record.payload,
  })

  assert.equal(result.anomalies.length, 0)
  const translated = result.translated[0]
  assert.ok(translated)
  assert.equal(Object.isFrozen(translated), true)
  assert.equal(Object.isFrozen(translated.clock), true)
  assert.equal(Object.isFrozen(translated.dependencyEventIds), true)
  assert.notEqual(translated.dependencyEventIds, dependencyEventIds)
  assert.equal(translated.payload, payload)
  assert.equal(Object.isFrozen(translated.payload), false)
  assert.equal(Object.isFrozen(translated.payload.nested), false)

  dependencyEventIds.push("evt-late")
  translated.payload.nested.mutable = false

  assert.deepEqual(translated.dependencyEventIds, ["evt-0"])
  assert.equal(payload.nested.mutable, false)
})

test("translateBatch separates invalid translated records into anomalies", () => {
  const records = [
    {
      id: "evt-1",
      node: "node-a",
      time: 1_000n,
    },
    {
      id: "",
      node: "node-b",
      time: 2_000n,
    },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
  })

  assert.equal(result.translated.length, 1)
  assert.equal(result.anomalies.length, 1)
  assert.equal(result.anomalies[0]?.code, "invalid_mapped_value")
  assert.equal(result.anomalies[0]?.field, "event_id")
  assert.equal(result.anomalies[0]?.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.stage, "field_validation")
  assert.equal(result.anomalies[0]?.expected, "non-empty string")
  assert.equal(result.anomalies[0]?.actualType, "string")
  assert.equal(result.anomalies[0]?.actualValue, "")
  assert.equal(result.anomalies[0]?.fieldReference.kind, "ingress_field")
  assert.equal(result.anomalies[0]?.fieldReference.field, "event_id")
  assert.equal(result.anomalies[0]?.fieldReference.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.classification.domain, "translation")
  assert.equal(result.anomalies[0]?.classification.family, "structural")
  assert.equal(result.anomalies[0]?.classification.category, "invalid_value")
  assert.equal(result.anomalies[0]?.classification.code, "invalid_mapped_value")
  assert.equal(result.anomalies[0]?.policy.key, "record_failure")
  assert.equal(result.anomalies[0]?.policy.action, "warn")
  assert.equal(result.anomalies[0]?.ordering.kind, "record_field_order")
  assert.equal(result.anomalies[0]?.ordering.sequence, 0)
  assert.equal(result.anomalies[0]?.ordering.recordIndex, 1)
  assert.equal(result.anomalies[0]?.ordering.fieldOrder, 0)
  assert.equal(result.anomalies[0]?.diagnostic.source, "structural")
  assert.equal(result.anomalies[0]?.diagnostic.classification.domain, "translation")
  assert.equal(result.anomalies[0]?.diagnostic.classification.family, "structural")
  assert.equal(result.anomalies[0]?.diagnostic.classification.category, "invalid_value")
  assert.equal(result.anomalies[0]?.diagnostic.policy.key, "record_failure")
  assert.equal(result.anomalies[0]?.diagnostic.policy.action, "warn")
  assert.equal(result.anomalies[0]?.diagnostic.ordering.kind, "record_field_order")
  assert.equal(result.anomalies[0]?.diagnostic.ordering.sequence, 0)
  assert.equal(result.anomalies[0]?.diagnostic.ordering.recordIndex, 1)
  assert.equal(result.anomalies[0]?.diagnostic.ordering.fieldOrder, 0)
  assert.equal(result.anomalies[0]?.diagnostic.stage, "field_validation")
  assert.equal(result.anomalies[0]?.diagnostic.record.index, 1)
  assert.equal(result.anomalies[0]?.diagnostic.record.input, records[1])
  assert.equal(result.anomalies[0]?.diagnostic.location.field, "event_id")
  assert.equal(result.anomalies[0]?.diagnostic.location.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.diagnostic.location.fieldReference.kind, "ingress_field")
  assert.equal(result.anomalies[0]?.diagnostic.location.fieldReference.field, "event_id")
  assert.equal(result.anomalies[0]?.diagnostic.location.fieldReference.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.diagnostic.contract.expected, "non-empty string")
  assert.equal(result.anomalies[0]?.diagnostic.contract.actualType, "string")
  assert.equal(result.anomalies[0]?.diagnostic.contract.actualValue, "")
  assert.equal(result.translated[0]?.id, "evt-1")
})

test("translateBatch distinguishes missing required mapper values from invalid mapped values", () => {
  const records = [
    { id: undefined, node: "node-a", time: 1_000n },
    { id: null, node: "node-b", time: 2_000n },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
  })

  assert.equal(result.translated.length, 0)
  assert.equal(result.anomalies.length, 2)
  assert.equal(result.anomalies[0]?.code, "missing_required_value")
  assert.equal(result.anomalies[0]?.field, "event_id")
  assert.equal(result.anomalies[0]?.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.stage, "mapper")
  assert.equal(result.anomalies[0]?.expected, "non-empty string")
  assert.equal(result.anomalies[0]?.actualType, "undefined")
  assert.equal(result.anomalies[0]?.classification.family, "mapping")
  assert.equal(result.anomalies[0]?.classification.category, "required_value_missing")
  assert.equal(result.anomalies[0]?.policy.key, "record_failure")
  assert.equal(result.anomalies[0]?.policy.action, "warn")
  assert.equal(result.anomalies[0]?.ordering.sequence, 0)
  assert.equal(result.anomalies[0]?.ordering.recordIndex, 0)
  assert.equal(result.anomalies[0]?.ordering.fieldOrder, 0)
  assert.equal(result.anomalies[0]?.diagnostic.source, "mapping")
  assert.equal(result.anomalies[0]?.diagnostic.classification.family, "mapping")
  assert.equal(result.anomalies[0]?.diagnostic.classification.category, "required_value_missing")
  assert.equal(result.anomalies[0]?.diagnostic.policy.key, "record_failure")
  assert.equal(result.anomalies[0]?.diagnostic.policy.action, "warn")
  assert.equal(result.anomalies[0]?.diagnostic.ordering.sequence, 0)
  assert.equal(result.anomalies[0]?.diagnostic.stage, "mapper")
  assert.equal(result.anomalies[0]?.diagnostic.record.index, 0)
  assert.equal(result.anomalies[0]?.diagnostic.location.field, "event_id")
  assert.equal(result.anomalies[0]?.diagnostic.location.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.diagnostic.contract.expected, "non-empty string")
  assert.equal(result.anomalies[0]?.diagnostic.contract.actualType, "undefined")
  assert.equal(result.anomalies[1]?.code, "invalid_mapped_value")
  assert.equal(result.anomalies[1]?.field, "event_id")
  assert.equal(result.anomalies[1]?.mapper, "getEventId")
  assert.equal(result.anomalies[1]?.stage, "field_validation")
  assert.equal(result.anomalies[1]?.actualType, "null")
  assert.equal(result.anomalies[1]?.classification.family, "structural")
  assert.equal(result.anomalies[1]?.classification.category, "invalid_value")
  assert.equal(result.anomalies[1]?.policy.key, "record_failure")
  assert.equal(result.anomalies[1]?.policy.action, "warn")
  assert.equal(result.anomalies[1]?.ordering.sequence, 1)
  assert.equal(result.anomalies[1]?.diagnostic.source, "structural")
})

test("translateBatch evaluates mappers in a deterministic field order and stops on the first unrecoverable issue", () => {
  const calls = []

  const result = translateBatch([{ id: "evt-1", node: "node-a", time: 1_000n }], {
    getEventId: (record) => {
      calls.push("event_id")
      return record.id
    },
    getNodeId: (record) => {
      calls.push("node_id")
      return record.node
    },
    getPhysicalTime: (record) => {
      calls.push("physical_time")
      return record.time
    },
    getLogicalCounter: () => {
      calls.push("logical_counter")
      return null
    },
    getSequence: () => {
      calls.push("sequence")
      return 1n
    },
  })

  assert.deepEqual(calls, [
    "event_id",
    "node_id",
    "physical_time",
    "logical_counter",
  ])
  assert.equal(result.translated.length, 0)
  assert.equal(result.anomalies.length, 1)
  assert.equal(result.anomalies[0]?.code, "invalid_mapped_value")
  assert.equal(result.anomalies[0]?.field, "logical_counter")
  assert.equal(result.anomalies[0]?.mapper, "getLogicalCounter")
  assert.equal(result.anomalies[0]?.stage, "field_validation")
  assert.equal(result.anomalies[0]?.expected, "non-negative safe integer or undefined")
  assert.equal(result.anomalies[0]?.actualType, "null")
  assert.equal(result.anomalies[0]?.policy.key, "optional_field_failure")
  assert.equal(result.anomalies[0]?.policy.action, "warn")
})

test("translateBatch treats mapper exceptions as structured field-specific anomalies", () => {
  const result = translateBatch([{ id: "evt-1", node: "node-a", time: 1_000n }], {
    getEventId: () => {
      throw new Error("boom")
    },
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
  })

  assert.equal(result.translated.length, 0)
  assert.equal(result.anomalies.length, 1)
  assert.equal(result.anomalies[0]?.code, "mapper_exception")
  assert.equal(result.anomalies[0]?.field, "event_id")
  assert.equal(result.anomalies[0]?.mapper, "getEventId")
  assert.equal(result.anomalies[0]?.stage, "mapper")
  assert.equal(result.anomalies[0]?.expected, "getEventId must return a value without throwing")
  assert.equal(result.anomalies[0]?.message, "boom")
  assert.equal(result.anomalies[0]?.classification.family, "mapping")
  assert.equal(result.anomalies[0]?.classification.category, "mapper_failure")
  assert.equal(result.anomalies[0]?.policy.key, "record_failure")
  assert.equal(result.anomalies[0]?.policy.action, "warn")
  assert.equal(result.anomalies[0]?.diagnostic.source, "mapping")
  assert.equal(result.anomalies[0]?.diagnostic.classification.family, "mapping")
  assert.equal(result.anomalies[0]?.diagnostic.classification.category, "mapper_failure")
  assert.equal(result.anomalies[0]?.diagnostic.policy.key, "record_failure")
  assert.equal(result.anomalies[0]?.diagnostic.policy.action, "warn")
  assert.equal(result.anomalies[0]?.diagnostic.location.field, "event_id")
  assert.equal(result.anomalies[0]?.diagnostic.location.mapper, "getEventId")
  assert.equal(
    result.anomalies[0]?.diagnostic.contract.expected,
    "getEventId must return a value without throwing",
  )
})

test("translateBatch accepts readonly dependency arrays but rejects non-array relationship values", () => {
  const records = [
    { id: "evt-1", node: "node-a", time: 1_000n, deps: Object.freeze(["evt-0"]) },
    { id: "evt-2", node: "node-b", time: 2_000n, deps: "evt-1" },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getDependencyEventIds: (record) => record.deps,
  })

  assert.equal(result.translated.length, 1)
  assert.deepEqual(result.translated[0]?.dependencyEventIds, ["evt-0"])
  assert.equal(result.anomalies.length, 1)
  assert.equal(result.anomalies[0]?.code, "invalid_mapped_value")
  assert.equal(result.anomalies[0]?.field, "dependency_event_ids")
  assert.equal(result.anomalies[0]?.mapper, "getDependencyEventIds")
  assert.equal(result.anomalies[0]?.stage, "field_validation")
  assert.equal(result.anomalies[0]?.actualType, "string")
  assert.equal(result.anomalies[0]?.policy.key, "optional_field_failure")
  assert.equal(result.anomalies[0]?.policy.action, "warn")
})

test("translateBatch normalizes bigint, safe integer number, and canonical integer string timestamps identically", () => {
  const records = [
    { id: "evt-bigint", node: "node-a", time: 1_000n, ingestedAt: -5_000n },
    { id: "evt-number", node: "node-b", time: 1_000, ingestedAt: -5_000 },
    { id: "evt-string", node: "node-c", time: "1000", ingestedAt: "-5000" },
    { id: "evt-negative-string", node: "node-d", time: "-1000" },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getIngestedAt: (record) => record.ingestedAt,
  })

  assert.equal(result.anomalies.length, 0)
  assert.deepEqual(
    result.translated.map((event) => event.clock.physicalTimeMs),
    [1_000n, 1_000n, 1_000n, -1_000n],
  )
  assert.deepEqual(
    result.translated.slice(0, 3).map((event) => event.ingestedAt),
    [-5_000n, -5_000n, -5_000n],
  )
})

test("translateBatch rejects unsupported date-like and non-canonical timestamp inputs deterministically", () => {
  const records = [
    { id: "evt-date", node: "node-a", time: new Date("2024-01-01T00:00:00.000Z") },
    { id: "evt-iso", node: "node-b", time: "2024-01-01T00:00:00.000Z" },
    { id: "evt-decimal", node: "node-c", time: "1000.5" },
    { id: "evt-exp", node: "node-d", time: "1e3" },
    { id: "evt-space", node: "node-e", time: " 1000 " },
    { id: "evt-plus", node: "node-f", time: "+1000" },
    { id: "evt-leading-zero", node: "node-g", time: "01" },
    { id: "evt-fractional-number", node: "node-h", time: 1000.5 },
    { id: "evt-nan", node: "node-i", time: Number.NaN },
    { id: "evt-infinity", node: "node-j", time: Number.POSITIVE_INFINITY },
    { id: "evt-unsafe", node: "node-k", time: Number.MAX_SAFE_INTEGER + 1 },
  ]

  const result = translateBatch(records, {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
  })

  assert.equal(result.translated.length, 0)
  assert.equal(result.anomalies.length, records.length)
  assert.ok(result.anomalies.every((anomaly) => anomaly.code === "invalid_mapped_value"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.field === "physical_time"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.mapper === "getPhysicalTime"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.stage === "timestamp_coercion"))
  assert.ok(result.anomalies.every((anomaly) =>
    anomaly.expected === "bigint, safe integer number, or canonical integer string epoch milliseconds",
  ))
  assert.ok(result.anomalies.every((anomaly) => anomaly.fieldReference.kind === "ingress_field"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.classification.domain === "translation"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.classification.family === "structural"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.classification.category === "invalid_value"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.policy.key === "record_failure"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.policy.action === "warn"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.source === "structural"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.classification.domain === "translation"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.classification.family === "structural"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.classification.category === "invalid_value"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.policy.key === "record_failure"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.policy.action === "warn"))
  assert.ok(result.anomalies.every((anomaly) => anomaly.diagnostic.stage === "timestamp_coercion"))
  assert.equal(result.anomalies[0]?.actualType, "date")
  assert.equal(
    result.anomalies[0]?.message,
    "Date values are not supported; use bigint, safe integer number, or canonical integer string epoch milliseconds",
  )
})

test("translateBatch can continue past invalid optional fields when optional-field policy is continue", () => {
  const result = translateBatch([{ id: "evt-1", node: "node-a", time: 1_000n, seq: null }], {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getSequence: (record) => record.seq,
    policy: {
      optionalFieldFailure: "continue",
    },
  })

  assert.equal(result.translated.length, 1)
  assert.equal(result.anomalies.length, 1)
  assert.equal(result.translated[0]?.id, "evt-1")
  assert.equal(result.translated[0]?.sequence, undefined)
  assert.equal(result.anomalies[0]?.field, "sequence")
  assert.equal(result.anomalies[0]?.policy.key, "optional_field_failure")
  assert.equal(result.anomalies[0]?.policy.action, "continue")
  assert.equal(result.anomalies[0]?.ordering.sequence, 0)
  assert.equal(result.anomalies[0]?.ordering.recordIndex, 0)
  assert.equal(result.anomalies[0]?.ordering.fieldOrder, 4)
  assert.equal(result.anomalies[0]?.diagnostic.policy.key, "optional_field_failure")
  assert.equal(result.anomalies[0]?.diagnostic.policy.action, "continue")
})

test("translateBatch emits continued and rejected anomalies in deterministic record-and-field order", () => {
  const records = [
    {
      id: "evt-1",
      node: "node-a",
      time: 1_000n,
      logicalCounter: null,
      deps: "evt-0",
      ingestedAt: "1e3",
    },
    {
      id: "evt-2",
      node: "node-b",
      time: 2_000n,
      partition: "",
      payload: undefined,
    },
    {
      id: "",
      node: "node-c",
      time: 3_000n,
    },
  ]

  const config = {
    getEventId: (record) => record.id,
    getNodeId: (record) => record.node,
    getPhysicalTime: (record) => record.time,
    getLogicalCounter: (record) => record.logicalCounter,
    getDependencyEventIds: (record) => record.deps,
    getIngestedAt: (record) => record.ingestedAt,
    getPartition: (record) => record.partition,
    getPayload: (record) => record.payload,
    policy: {
      optionalFieldFailure: "continue",
    },
  }

  const first = translateBatch(records, config)
  const second = translateBatch(records, config)

  assert.equal(first.translated.length, 2)
  assert.equal(first.anomalies.length, 5)
  assert.deepEqual(
    first.anomalies.map((anomaly) => ({
      sequence: anomaly.ordering.sequence,
      recordIndex: anomaly.ordering.recordIndex,
      fieldOrder: anomaly.ordering.fieldOrder,
      field: anomaly.field,
      code: anomaly.code,
    })),
    [
      { sequence: 0, recordIndex: 0, fieldOrder: 3, field: "logical_counter", code: "invalid_mapped_value" },
      { sequence: 1, recordIndex: 0, fieldOrder: 6, field: "dependency_event_ids", code: "invalid_mapped_value" },
      { sequence: 2, recordIndex: 0, fieldOrder: 9, field: "ingested_at", code: "invalid_mapped_value" },
      { sequence: 3, recordIndex: 1, fieldOrder: 8, field: "partition", code: "invalid_mapped_value" },
      { sequence: 4, recordIndex: 2, fieldOrder: 0, field: "event_id", code: "invalid_mapped_value" },
    ],
  )
  assert.deepEqual(
    second.anomalies.map((anomaly) => ({
      sequence: anomaly.ordering.sequence,
      recordIndex: anomaly.ordering.recordIndex,
      fieldOrder: anomaly.ordering.fieldOrder,
      field: anomaly.field,
      code: anomaly.code,
    })),
    first.anomalies.map((anomaly) => ({
      sequence: anomaly.ordering.sequence,
      recordIndex: anomaly.ordering.recordIndex,
      fieldOrder: anomaly.ordering.fieldOrder,
      field: anomaly.field,
      code: anomaly.code,
    })),
  )
})

test("translateBatch can fail fast on record failures when record-failure policy is fail", () => {
  assert.throws(
    () => translateBatch([{ id: "", node: "node-a", time: 1_000n }], {
      getEventId: (record) => record.id,
      getNodeId: (record) => record.node,
      getPhysicalTime: (record) => record.time,
      policy: {
        recordFailure: "fail",
      },
    }),
    (error) => {
      assert.ok(error instanceof TranslateBatchPolicyError)
      assert.equal(error.anomaly.field, "event_id")
      assert.equal(error.anomaly.policy.key, "record_failure")
      assert.equal(error.anomaly.policy.action, "fail")
      return true
    },
  )
})

test("translateBatch can fail fast on optional-field failures when optional-field policy is fail", () => {
  assert.throws(
    () => translateBatch([{ id: "evt-1", node: "node-a", time: 1_000n, deps: "evt-0" }], {
      getEventId: (record) => record.id,
      getNodeId: (record) => record.node,
      getPhysicalTime: (record) => record.time,
      getDependencyEventIds: (record) => record.deps,
      policy: {
        optionalFieldFailure: "fail",
      },
    }),
    (error) => {
      assert.ok(error instanceof TranslateBatchPolicyError)
      assert.equal(error.anomaly.field, "dependency_event_ids")
      assert.equal(error.anomaly.policy.key, "optional_field_failure")
      assert.equal(error.anomaly.policy.action, "fail")
      return true
    },
  )
})
