import assert from "node:assert/strict"

import {
  ingestedAtWatermark,
  orderEventStream,
} from "../../dist/index.js"
import { collectAsync, makeEvent } from "../helpers/events.mjs"
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

function createBaseStreamingEvents({ seed, deviceCount, eventsPerDevice }) {
  const random = createSeededRandom(seed)
  const events = []
  const lastEventIdByNode = new Map()

  for (let deviceIndex = 0; deviceIndex < deviceCount; deviceIndex += 1) {
    const nodeId = `device-${String(deviceIndex + 1).padStart(2, "0")}`
    let physicalTimeMs = 1_000_000n + BigInt(deviceIndex * 20_000)

    for (let sequence = 1; sequence <= eventsPerDevice; sequence += 1) {
      physicalTimeMs += 500n + BigInt(pickInt(random, 0, 80))
      const id = `${nodeId}-evt-${sequence}`
      const parentEventId = lastEventIdByNode.get(nodeId)
      lastEventIdByNode.set(nodeId, id)

      events.push(makeEvent({
        id,
        nodeId,
        physicalTimeMs,
        logicalCounter: sequence % 4,
        sequence: BigInt(sequence),
        parentEventId,
        ingestedAt: physicalTimeMs + BigInt(pickInt(random, 0, 150)),
        payload: {
          type: sequence % 3 === 0 ? "sync" : "observe",
          facility: deviceIndex % 2 === 0 ? "clinic-a" : "clinic-b",
        },
      }))
    }
  }

  return events
}

function applyReconnectBacklogNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0xa5a5a5a5)
  const delayedNodeIds = new Set()
  const delayedDelayByNode = new Map()
  const delayedStartByNode = new Map()
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (const nodeId of nodeIds) {
    if (randomBool(random, 0.45)) {
      delayedNodeIds.add(nodeId)
      delayedDelayByNode.set(nodeId, BigInt(pickInt(random, 14_400_000, 28_800_000)))
      delayedStartByNode.set(nodeId, pickInt(random, 2, 5))
    }
  }

  if (delayedNodeIds.size === 0 && nodeIds.length > 0) {
    const fallbackNodeId = nodeIds[0]
    delayedNodeIds.add(fallbackNodeId)
    delayedDelayByNode.set(fallbackNodeId, 18_000_000n)
    delayedStartByNode.set(fallbackNodeId, 3)
  }

  const events = baseEvents.map((event) => {
    const startSequence = delayedStartByNode.get(event.nodeId)
    if (
      startSequence !== undefined &&
      event.sequence !== undefined &&
      event.sequence >= BigInt(startSequence)
    ) {
      const delayedEvent = {
        ...event,
        payload: {
          ...event.payload,
          reconnectReplay: true,
        },
        ingestedAt: (event.ingestedAt ?? event.clock.physicalTimeMs) + (delayedDelayByNode.get(event.nodeId) ?? 0n),
      }

      return delayedEvent
    }

    return {
      ...event,
      payload: {
        ...event.payload,
      },
    }
  })

  events.sort((a, b) => {
    const left = a.ingestedAt ?? a.clock.physicalTimeMs
    const right = b.ingestedAt ?? b.clock.physicalTimeMs

    if (left < right) return -1
    if (left > right) return 1
    return a.id.localeCompare(b.id)
  })

  return {
    events,
    delayedEventIds: events
      .filter((event) => event.payload.reconnectReplay === true)
      .map((event) => event.id),
  }
}

async function* sourceFromEvents(events) {
  for (const event of events) {
    yield event
  }
}

function summarizeBatches(batches) {
  return batches.map((batch) => ({
    watermark: batch.watermark.toString(),
    isFinal: batch.isFinal,
    correction: batch.correction === undefined
      ? undefined
      : {
          reason: batch.correction.reason,
          scope: batch.correction.scope,
          triggerEventId: batch.correction.triggerEventId,
        },
    anomalyHorizon: batch.anomalyHorizon,
    events: batch.events.map((entry) => ({
      id: entry.event.id,
      nodeId: entry.event.nodeId,
      sequence: entry.event.sequence?.toString(),
      orderBasis: entry.orderBasis,
      confidence: entry.confidence,
    })),
    anomalies: batch.anomalies.map((anomaly) => ({
      type: anomaly.type,
      eventId: anomaly.event?.id,
      relatedEventIds: anomaly.relatedEvents?.map((event) => event.id),
      severity: anomaly.severity,
    })),
  }))
}

async function collectStream(events, options) {
  return collectAsync(orderEventStream(sourceFromEvents(events), options))
}

async function assertStreamDeterminism({ seed, events, options }) {
  const first = await collectStream(events, options)
  const second = await collectStream(events, options)

  assert.deepEqual(
    summarizeBatches(first),
    summarizeBatches(second),
    `stream batches changed for seed ${seed}`,
  )
}

function assertWatermarksMonotonic({ seed, batches }) {
  for (let index = 1; index < batches.length; index += 1) {
    assert.ok(
      batches[index - 1].watermark <= batches[index].watermark,
      `watermark regressed between batches ${index - 1} and ${index} for seed ${seed}`,
    )
  }
}

function assertNodeSequencesMonotonic({ seed, batches }) {
  const sequencesByNode = new Map()

  for (const batch of batches) {
    for (const entry of batch.events) {
      if (entry.event.sequence === undefined) {
        continue
      }

      const existing = sequencesByNode.get(entry.event.nodeId) ?? []
      existing.push(entry.event.sequence)
      sequencesByNode.set(entry.event.nodeId, existing)
    }
  }

  for (const [nodeId, sequences] of sequencesByNode) {
    for (let index = 1; index < sequences.length; index += 1) {
      assert.ok(
        sequences[index - 1] <= sequences[index],
        `sequence order regressed for ${nodeId} under seed ${seed}`,
      )
    }
  }
}

test("0.3.2 streaming reconnect fuzz keeps correction batches reproducible across seeded outage backlogs", async () => {
  const seeds = [17, 41, 67, 101, 137]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingEvents({
      seed,
      deviceCount: 8,
      eventsPerDevice: 7,
    })
    const { events, delayedEventIds } = applyReconnectBacklogNoise(baseEvents, seed)
    const options = {
      batchSize: 6,
      maxLateArrivalMs: 60_000n,
      lateArrivalPolicy: "emit_correction",
      watermark: ingestedAtWatermark,
      strict: false,
    }

    await assertStreamDeterminism({
      seed,
      events,
      options,
    })

    const batches = await collectStream(events, options)
    const correctionBatches = batches.filter((batch) => batch.correction !== undefined)
    const lateArrivalIds = batches.flatMap((batch) =>
      batch.anomalies
        .filter((anomaly) => anomaly.type === "late_arrival" && anomaly.event !== undefined)
        .map((anomaly) => anomaly.event.id),
    )

    assert.ok(delayedEventIds.length > 0, `expected delayed reconnect events for seed ${seed}`)
    assertWatermarksMonotonic({ seed, batches })
    assertNodeSequencesMonotonic({ seed, batches })
    assert.equal(correctionBatches.length, delayedEventIds.length)
    assert.deepEqual(
      correctionBatches.map((batch) => batch.correction?.triggerEventId),
      delayedEventIds,
      `correction triggers changed for seed ${seed}`,
    )
    assert.deepEqual(
      lateArrivalIds,
      delayedEventIds,
      `late-arrival visibility changed for seed ${seed}`,
    )
    assert.ok(correctionBatches.every((batch) => batch.correction?.reason === "late_arrival"))
    assert.ok(correctionBatches.every((batch) => batch.isFinal === false))
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})

test("0.3.2 streaming reconnect fuzz keeps flag-mode late-arrival visibility reproducible across seeds", async () => {
  const seeds = [19, 43, 73, 109, 163]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingEvents({
      seed,
      deviceCount: 7,
      eventsPerDevice: 6,
    })
    const { events, delayedEventIds } = applyReconnectBacklogNoise(baseEvents, seed)
    const options = {
      batchSize: 5,
      maxLateArrivalMs: 45_000n,
      lateArrivalPolicy: "flag",
      watermark: ingestedAtWatermark,
      strict: false,
    }

    await assertStreamDeterminism({
      seed,
      events,
      options,
    })

    const batches = await collectStream(events, options)
    const lateArrivalIds = batches.flatMap((batch) =>
      batch.anomalies
        .filter((anomaly) => anomaly.type === "late_arrival" && anomaly.event !== undefined)
        .map((anomaly) => anomaly.event.id),
    )
    const emittedDelayedIds = batches.flatMap((batch) =>
      batch.events
        .filter((entry) => entry.event.payload.reconnectReplay === true)
        .map((entry) => entry.event.id),
    )

    assert.ok(delayedEventIds.length > 0, `expected delayed reconnect events for seed ${seed}`)
    assertWatermarksMonotonic({ seed, batches })
    assertNodeSequencesMonotonic({ seed, batches })
    assert.deepEqual(
      lateArrivalIds,
      delayedEventIds,
      `late-arrival visibility changed for seed ${seed}`,
    )
    assert.deepEqual(
      emittedDelayedIds,
      delayedEventIds,
      `flag-mode output dropped reconnect events for seed ${seed}`,
    )
    assert.equal(
      batches.some((batch) => batch.correction !== undefined),
      false,
      `flag mode emitted correction metadata for seed ${seed}`,
    )
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})
