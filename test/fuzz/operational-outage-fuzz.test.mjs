import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"

function createSeededRandom(seed) {
  let state = seed >>> 0

  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function pickInt(random, min, maxInclusive) {
  return min + Math.floor(random() * (maxInclusive - min + 1))
}

function randomBool(random, probability) {
  return random() < probability
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

function makeEvent({
  id,
  nodeId,
  physicalTimeMs,
  logicalCounter = 0,
  payload,
  sequence,
  parentEventId,
  dependencyEventIds,
  ingestedAt,
}) {
  const event = {
    id,
    nodeId,
    clock: {
      physicalTimeMs,
      logicalCounter,
      nodeId,
    },
    payload,
  }

  if (sequence !== undefined) {
    event.sequence = sequence
  }
  if (parentEventId !== undefined) {
    event.parentEventId = parentEventId
  }
  if (dependencyEventIds !== undefined && dependencyEventIds.length > 0) {
    event.dependencyEventIds = dependencyEventIds
  }
  if (ingestedAt !== undefined) {
    event.ingestedAt = ingestedAt
  }

  return event
}

function createBaseOperationalEvents({
  totalEvents,
  nodeCount,
  seed,
}) {
  const random = createSeededRandom(seed)
  const nodeSequences = Array.from({ length: nodeCount }, () => 0n)
  const nodeTimes = Array.from({ length: nodeCount }, (_, index) => 1_000n + BigInt(index * 10))
  const lastEventIdByNode = Array.from({ length: nodeCount }, () => undefined)
  const events = []

  for (let index = 0; index < totalEvents; index += 1) {
    const nodeIndex = index % nodeCount
    const nodeId = `node-${String(nodeIndex + 1).padStart(2, "0")}`
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const physicalTimeMs =
      nodeTimes[nodeIndex] + 5n + BigInt(pickInt(random, 0, 3))
    nodeTimes[nodeIndex] = physicalTimeMs

    const id = `evt-${index + 1}`
    const parentEventId = lastEventIdByNode[nodeIndex]
    const dependencyEventIds = []

    if (index >= nodeCount && index % 11 === 0) {
      const dependencyNodeIndex = (nodeIndex + nodeCount - 1) % nodeCount
      const dependencyEventId = lastEventIdByNode[dependencyNodeIndex]
      if (dependencyEventId !== undefined) {
        dependencyEventIds.push(dependencyEventId)
      }
    }

    lastEventIdByNode[nodeIndex] = id

    events.push(makeEvent({
      id,
      nodeId,
      physicalTimeMs,
      logicalCounter: Number(sequence % 4n),
      payload: {
        type: index % 3 === 0 ? "write" : "read",
        region: nodeIndex % 2 === 0 ? "clinic-a" : "clinic-b",
        value: index,
      },
      sequence,
      parentEventId,
      dependencyEventIds: dependencyEventIds.length > 0 ? dependencyEventIds : undefined,
      ingestedAt: physicalTimeMs + BigInt(index % 7),
    }))
  }

  return events
}

function applyOperationalOutageNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x9e3779b9)
  const noisyEvents = []

  for (const event of baseEvents) {
    if (randomBool(random, 0.03)) {
      continue
    }

    const mutated = {
      ...event,
      clock: {
        ...event.clock,
      },
      payload: {
        ...event.payload,
      },
      dependencyEventIds: event.dependencyEventIds === undefined
        ? undefined
        : [...event.dependencyEventIds],
    }

    if (randomBool(random, 0.08)) {
      mutated.ingestedAt = (mutated.ingestedAt ?? mutated.clock.physicalTimeMs) + BigInt(pickInt(random, 14_400_000, 28_800_000))
      mutated.payload.outageReplay = true
    }

    if (randomBool(random, 0.05)) {
      mutated.clock.physicalTimeMs += BigInt(pickInt(random, -5_000, 5_000))
      if (mutated.clock.physicalTimeMs < 0n) {
        mutated.clock.physicalTimeMs = 0n
      }
      mutated.payload.clockDrifted = true
    }

    if (randomBool(random, 0.03)) {
      mutated.clock.physicalTimeMs = -1n
      mutated.payload.corruptedClock = true
    }

    noisyEvents.push(mutated)
  }

  return shuffleWithRandom(noisyEvents, random)
}

function createDuplicateReplayNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x7f4a7c15)
  const duplicates = []

  for (const event of baseEvents) {
    if (!randomBool(random, 0.08)) {
      continue
    }

    const replayNodeId = `replay-${pickInt(random, 1, 4)}`
    duplicates.push({
      ...event,
      nodeId: replayNodeId,
      clock: {
        ...event.clock,
        nodeId: replayNodeId,
        physicalTimeMs: event.clock.physicalTimeMs + BigInt(pickInt(random, 1_000, 10_000)),
      },
      payload: {
        ...event.payload,
        duplicateReplay: true,
      },
    })
  }

  return shuffleWithRandom([...baseEvents, ...duplicates], random)
}

function summarizeOrdered(result) {
  return result.ordered.map((entry) => ({
    id: entry.event.id,
    nodeId: entry.event.nodeId,
    orderBasis: entry.orderBasis,
    confidence: entry.confidence,
    evidence: entry.causalEvidence,
  }))
}

function summarizeAnomalies(result) {
  return result.anomalies.map((anomaly) => ({
    type: anomaly.type,
    eventId: anomaly.event?.id,
    relatedEventIds: anomaly.relatedEvents?.map((event) => event.id),
    severity: anomaly.severity,
  }))
}

function collectSupportedEdges(events) {
  const edges = []
  const eventsById = new Map(events.map((event) => [event.id, event]))
  const byNode = new Map()

  for (const event of events) {
    if (event.parentEventId !== undefined && eventsById.has(event.parentEventId)) {
      edges.push([event.parentEventId, event.id])
    }

    for (const dependencyEventId of event.dependencyEventIds ?? []) {
      if (eventsById.has(dependencyEventId)) {
        edges.push([dependencyEventId, event.id])
      }
    }

    const nodeEvents = byNode.get(event.nodeId) ?? []
    nodeEvents.push(event)
    byNode.set(event.nodeId, nodeEvents)
  }

  for (const [, nodeEvents] of byNode) {
    const sequenced = nodeEvents
      .filter((event) => event.sequence !== undefined)
      .sort((a, b) => {
        if (a.sequence < b.sequence) return -1
        if (a.sequence > b.sequence) return 1
        return a.id.localeCompare(b.id)
      })

    for (let index = 1; index < sequenced.length; index += 1) {
      const previous = sequenced[index - 1]
      const current = sequenced[index]
      if (previous.sequence < current.sequence) {
        edges.push([previous.id, current.id])
      }
    }
  }

  return edges
}

function collectOrderedNodeHistories(result) {
  const byNode = new Map()

  for (const entry of result.ordered) {
    if (entry.event.sequence === undefined) {
      continue
    }

    const nodeEntries = byNode.get(entry.event.nodeId) ?? []
    nodeEntries.push({
      eventKey: `${entry.event.id}@${entry.event.nodeId}`,
      sequence: entry.event.sequence.toString(),
    })
    byNode.set(entry.event.nodeId, nodeEntries)
  }

  return Object.fromEntries(
    [...byNode.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([nodeId, entries]) => [nodeId, entries.sort((a, b) => {
        if (a.sequence !== b.sequence) {
          return Number(BigInt(a.sequence) - BigInt(b.sequence))
        }

        return a.eventKey.localeCompare(b.eventKey)
      })]),
  )
}

function countAnomalies(result) {
  const counts = new Map()

  for (const anomaly of result.anomalies) {
    counts.set(anomaly.type, (counts.get(anomaly.type) ?? 0) + 1)
  }

  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => a.localeCompare(b)))
}

function assertSeededDeterminism({ seed, events, options }) {
  const first = orderEvents(events, options)
  const second = orderEvents(events, options)

  assert.deepEqual(
    summarizeOrdered(first),
    summarizeOrdered(second),
    `ordered output changed for seed ${seed}`,
  )
  assert.deepEqual(
    summarizeAnomalies(first),
    summarizeAnomalies(second),
    `anomaly output changed for seed ${seed}`,
  )
}

function assertCausalConclusionsStableUnderShuffle({ seed, events, options }) {
  const baseline = orderEvents(events, options)
  const baselineNodeHistories = collectOrderedNodeHistories(baseline)
  const shuffledEvents = shuffleWithRandom(events, createSeededRandom(seed ^ 0x85ebca6b))
  const shuffled = orderEvents(shuffledEvents, options)
  const shuffledNodeHistories = collectOrderedNodeHistories(shuffled)

  assert.deepEqual(
    baselineNodeHistories,
    shuffledNodeHistories,
    `same-node sequence conclusions changed under shuffle for seed ${seed}`,
  )

  const baselineCounts = countAnomalies(baseline)
  const shuffledCounts = countAnomalies(shuffled)

  assert.equal(
    baselineCounts.duplicate_event ?? 0,
    shuffledCounts.duplicate_event ?? 0,
    `duplicate visibility changed under shuffle for seed ${seed}`,
  )
  assert.equal(
    baselineCounts.invalid_clock ?? 0,
    shuffledCounts.invalid_clock ?? 0,
    `invalid-clock visibility changed under shuffle for seed ${seed}`,
  )

  assert.equal(
    baseline.stats.validEvents,
    shuffled.stats.validEvents,
    `valid-event count changed under shuffle for seed ${seed}`,
  )
  assert.equal(
    baseline.stats.invalidEvents,
    shuffled.stats.invalidEvents,
    `invalid-event count changed under shuffle for seed ${seed}`,
  )
}

function assertCurrentCoreInvariants({ seed, events, options }) {
  const result = orderEvents(events, options)
  const indexById = new Map(result.ordered.map((entry, index) => [entry.event.id, index]))

  for (const [beforeId, afterId] of collectSupportedEdges(result.ordered.map((entry) => entry.event))) {
    const beforeIndex = indexById.get(beforeId)
    const afterIndex = indexById.get(afterId)
    assert.ok(
      beforeIndex !== undefined && afterIndex !== undefined && beforeIndex < afterIndex,
      `supported edge ${beforeId} -> ${afterId} was violated for seed ${seed}`,
    )
  }

  const anomalyTypes = new Set(result.anomalies.map((anomaly) => anomaly.type))

  if (events.some((event) => event.clock.physicalTimeMs < 0n)) {
    assert.ok(anomalyTypes.has("invalid_clock"), `expected invalid_clock for seed ${seed}`)
  }

  const duplicateIds = new Set()
  const seenIds = new Set()
  for (const event of events) {
    if (seenIds.has(event.id)) {
      duplicateIds.add(event.id)
    } else {
      seenIds.add(event.id)
    }
  }
  if (duplicateIds.size > 0) {
    assert.ok(anomalyTypes.has("duplicate_event"), `expected duplicate_event for seed ${seed}`)
  }
}

test("0.3.2 operational outage fuzz keeps seeded conclusions reproducible across randomized delay, drop, drift, and corruption noise", () => {
  const seeds = [11, 23, 47, 71, 97, 131, 173, 211]
  const options = {
    strict: false,
    detectAnomalies: true,
  }

  for (const seed of seeds) {
    const baseEvents = createBaseOperationalEvents({
      totalEvents: 180,
      nodeCount: 12,
      seed,
    })
    const noisyEvents = applyOperationalOutageNoise(baseEvents, seed)

    assertSeededDeterminism({
      seed,
      events: noisyEvents,
      options,
    })

    assertCausalConclusionsStableUnderShuffle({
      seed,
      events: noisyEvents,
      options,
    })

    assertCurrentCoreInvariants({
      seed,
      events: noisyEvents,
      options,
    })
  }
})

test("0.3.2 duplicate-upload fuzz keeps exact duplicate visibility reproducible across seeds and shuffled arrival", () => {
  const seeds = [13, 29, 53, 89, 149]
  const options = {
    strict: false,
    detectAnomalies: true,
  }

  for (const seed of seeds) {
    const baseEvents = createBaseOperationalEvents({
      totalEvents: 140,
      nodeCount: 10,
      seed,
    })
    const noisyEvents = createDuplicateReplayNoise(baseEvents, seed)

    assertSeededDeterminism({
      seed,
      events: noisyEvents,
      options,
    })

    const baseline = orderEvents(noisyEvents, options)
    const shuffled = orderEvents(
      shuffleWithRandom(noisyEvents, createSeededRandom(seed ^ 0x85ebca6b)),
      options,
    )

    const baselineCounts = countAnomalies(baseline)
    const shuffledCounts = countAnomalies(shuffled)

    assert.ok(
      (baselineCounts.duplicate_event ?? 0) > 0,
      `expected duplicate visibility for seed ${seed}`,
    )
    assert.equal(
      baselineCounts.duplicate_event ?? 0,
      shuffledCounts.duplicate_event ?? 0,
      `duplicate visibility changed under shuffle for seed ${seed}`,
    )
  }
})
