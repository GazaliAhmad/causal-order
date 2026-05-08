import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

function createSeededRandom(seed) {
  let state = seed >>> 0

  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffleWithRandom(items, random) {
  const copy = [...items]

  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = copy[index]
    copy[index] = copy[swapIndex]
    copy[swapIndex] = current
  }

  return copy
}

function createGeneratedEvents({
  totalEvents,
  nodeCount,
  seed,
}) {
  const random = createSeededRandom(seed)
  const nodeSequences = Array.from({ length: nodeCount }, () => 0n)
  const nodeTimes = Array.from({ length: nodeCount }, (_, index) => 1_000n + BigInt(index))
  const lastEventIdByNode = Array.from({ length: nodeCount }, () => undefined)
  const events = []

  for (let index = 0; index < totalEvents; index += 1) {
    const nodeIndex = index % nodeCount
    const nodeId = `node-${String(nodeIndex + 1).padStart(2, "0")}`
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const physicalTimeMs = nodeTimes[nodeIndex] + 5n + BigInt(Math.floor(random() * 3))
    nodeTimes[nodeIndex] = physicalTimeMs

    const parentEventId = lastEventIdByNode[nodeIndex]
    const dependencyEventIds = []

    if (index >= nodeCount && index % 11 === 0) {
      const dependencyNodeIndex = (nodeIndex + nodeCount - 1) % nodeCount
      const dependencyEventId = lastEventIdByNode[dependencyNodeIndex]
      if (dependencyEventId !== undefined) {
        dependencyEventIds.push(dependencyEventId)
      }
    }

    const id = `evt-${index + 1}`
    lastEventIdByNode[nodeIndex] = id

    events.push(makeEvent({
      id,
      nodeId,
      sequence,
      physicalTimeMs,
      parentEventId,
      dependencyEventIds: dependencyEventIds.length > 0 ? dependencyEventIds : undefined,
      ingestedAt: physicalTimeMs + BigInt(index % 5),
      payload: { index },
    }))
  }

  return shuffleWithRandom(events, random)
}

test("orderEvents does not produce false unknown-order anomalies when multiple proofs imply the same edge", () => {
  const parent = makeEvent({
    id: "evt-1",
    nodeId: "node-a",
    sequence: 1n,
    physicalTimeMs: 1_000n,
  })
  const child = makeEvent({
    id: "evt-2",
    nodeId: "node-a",
    sequence: 2n,
    parentEventId: "evt-1",
    physicalTimeMs: 1_100n,
  })

  const result = orderEvents([child, parent], {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(
    result.ordered.map((entry) => entry.event.id),
    ["evt-1", "evt-2"],
  )
  assert.equal(
    result.anomalies.some((anomaly) => anomaly.type === "unknown_order"),
    false,
  )
})

test("orderEvents reports causal cycles in non-strict mode and throws in strict mode", () => {
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

  const nonStrict = orderEvents([eventA, eventB, eventC], {
    strict: false,
    detectAnomalies: true,
  })

  assert.equal(
    nonStrict.anomalies.filter((anomaly) => anomaly.type === "unknown_order").length,
    3,
  )
  assert.ok(nonStrict.ordered.every((entry) => entry.confidence === "unknown"))
  assert.ok(
    nonStrict.ordered.every((entry) => entry.orderBasis === "deterministic_tiebreaker"),
  )
  assert.throws(
    () => orderEvents([eventA, eventB, eventC], { strict: true }),
    /Unable to produce a complete ordering/,
  )
})

test("orderEvents stays deterministic for repeated large-batch runs", () => {
  const events = createGeneratedEvents({
    totalEvents: 2_000,
    nodeCount: 16,
    seed: 42,
  })

  const first = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })
  const second = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  assert.deepEqual(
    first.ordered.map((entry) => ({
      id: entry.event.id,
      orderIndex: entry.orderIndex.toString(),
      orderBasis: entry.orderBasis,
      confidence: entry.confidence,
    })),
    second.ordered.map((entry) => ({
      id: entry.event.id,
      orderIndex: entry.orderIndex.toString(),
      orderBasis: entry.orderBasis,
      confidence: entry.confidence,
    })),
  )
  assert.deepEqual(
    first.anomalies.map((anomaly) => ({
      type: anomaly.type,
      eventId: anomaly.event?.id,
      message: anomaly.message,
    })),
    second.anomalies.map((anomaly) => ({
      type: anomaly.type,
      eventId: anomaly.event?.id,
      message: anomaly.message,
    })),
  )
})

test("orderEvents preserves explicit causal and same-node sequence invariants across generated event sets", () => {
  for (let seed = 1; seed <= 8; seed += 1) {
    const events = createGeneratedEvents({
      totalEvents: 120,
      nodeCount: 8,
      seed,
    })
    const result = orderEvents(events, {
      strict: false,
      detectAnomalies: true,
    })
    const indexById = new Map(result.ordered.map((entry, index) => [entry.event.id, index]))
    const byNode = new Map()

    for (const event of events) {
      if (event.parentEventId !== undefined) {
        assert.ok(indexById.get(event.parentEventId) < indexById.get(event.id))
      }

      for (const dependencyEventId of event.dependencyEventIds ?? []) {
        assert.ok(indexById.get(dependencyEventId) < indexById.get(event.id))
      }

      const nodeEvents = byNode.get(event.nodeId) ?? []
      nodeEvents.push(event)
      byNode.set(event.nodeId, nodeEvents)
    }

    for (const [, nodeEvents] of byNode) {
      const sequenced = nodeEvents
        .filter((event) => event.sequence !== undefined)
        .sort((a, b) => Number(a.sequence - b.sequence))

      for (let index = 1; index < sequenced.length; index += 1) {
        assert.ok(indexById.get(sequenced[index - 1].id) < indexById.get(sequenced[index].id))
      }
    }
  }
})

test("orderEvents does not treat shared traceId as causal evidence on its own", () => {
  const traceId = "trace-checkout-1"
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "api-a",
    physicalTimeMs: 1_000n,
    traceId,
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "worker-b",
    physicalTimeMs: 1_001n,
    traceId,
  })

  const result = orderEvents([eventB, eventA], {
    strict: false,
    detectAnomalies: true,
  })

  assert.ok(result.ordered.every((entry) => entry.confidence !== "proven"))
  assert.ok(result.ordered.every((entry) => entry.causalEvidence === undefined))
})

test("orderEvents does not treat shared partition as causal evidence on its own", () => {
  const partition = "tenant-42"
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "api-a",
    physicalTimeMs: 1_000n,
    partition,
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "worker-b",
    physicalTimeMs: 1_001n,
    partition,
  })

  const result = orderEvents([eventB, eventA], {
    strict: false,
    detectAnomalies: true,
  })

  assert.ok(result.ordered.every((entry) => entry.confidence !== "proven"))
  assert.ok(result.ordered.every((entry) => entry.causalEvidence === undefined))
})
