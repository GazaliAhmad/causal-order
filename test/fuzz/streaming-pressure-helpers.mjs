import assert from "node:assert/strict"

import { orderEventStream } from "../../dist/index.js"
import { collectAsync, makeEvent } from "../helpers/events.mjs"

export const expectedStreamingAnomalyHorizon = {
  retainedEventHistory: "buffered_window_only",
  crossWindowRelationalDetection: "late_arrival_only",
}

export function createSeededRandom(seed) {
  let state = seed >>> 0

  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

export function pickInt(random, min, maxInclusive) {
  return min + Math.floor(random() * (maxInclusive - min + 1))
}

export function randomBool(random, probability) {
  return random() < probability
}

export function createBaseStreamingPressureEvents({ seed, deviceCount, eventsPerDevice }) {
  const random = createSeededRandom(seed)
  const events = []
  const lastEventIdByNode = new Map()
  const lastDependencyByNode = new Map()

  for (let deviceIndex = 0; deviceIndex < deviceCount; deviceIndex += 1) {
    const nodeId = `device-${String(deviceIndex + 1).padStart(2, "0")}`
    let physicalTimeMs = 2_000_000n + BigInt(deviceIndex * 15_000)

    for (let sequence = 1; sequence <= eventsPerDevice; sequence += 1) {
      physicalTimeMs += 320n + BigInt(pickInt(random, 0, 90))
      const id = `${nodeId}-evt-${sequence}`
      const parentEventId = lastEventIdByNode.get(nodeId)
      const dependencyEventIds = []

      if (sequence > 1 && sequence % 5 === 0) {
        const dependencyNodeId = `device-${String(((deviceIndex + 1) % deviceCount) + 1).padStart(2, "0")}`
        const dependencyEventId = lastDependencyByNode.get(dependencyNodeId)
        if (dependencyEventId !== undefined) {
          dependencyEventIds.push(dependencyEventId)
        }
      }

      lastEventIdByNode.set(nodeId, id)
      lastDependencyByNode.set(nodeId, id)

      events.push(makeEvent({
        id,
        nodeId,
        physicalTimeMs,
        logicalCounter: 0,
        sequence: BigInt(sequence),
        parentEventId,
        dependencyEventIds: dependencyEventIds.length > 0 ? dependencyEventIds : undefined,
        ingestedAt: physicalTimeMs + BigInt(pickInt(random, 0, 160)),
        payload: {
          type: sequence % 4 === 0 ? "sync" : "observe",
          facility: deviceIndex % 2 === 0 ? "clinic-a" : "clinic-b",
        },
      }))
    }
  }

  return events
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

export async function collectStream(events, options) {
  return collectAsync(orderEventStream(sourceFromEvents(events), options))
}

export async function assertStreamDeterminism({ seed, events, options }) {
  const first = await collectStream(events, options)
  const second = await collectStream(events, options)

  assert.deepEqual(
    summarizeBatches(first),
    summarizeBatches(second),
    `stream batches changed for seed ${seed}`,
  )
}

export function assertWatermarksMonotonic({ seed, batches }) {
  for (let index = 1; index < batches.length; index += 1) {
    assert.ok(
      batches[index - 1].watermark <= batches[index].watermark,
      `watermark regressed between batches ${index - 1} and ${index} for seed ${seed}`,
    )
  }
}

export function assertNodeSequencesMonotonic({ seed, batches }) {
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

export function assertAnomalyHorizonExplicit({ seed, batches }) {
  for (const batch of batches) {
    assert.deepEqual(
      batch.anomalyHorizon,
      expectedStreamingAnomalyHorizon,
      `anomaly horizon changed for seed ${seed}`,
    )
  }
}
