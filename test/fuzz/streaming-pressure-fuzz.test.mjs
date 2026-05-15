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

function createBaseStreamingPressureEvents({ seed, deviceCount, eventsPerDevice }) {
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

function applyFragmentedWatermarkLagNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x6d2b79f5)
  const delayedNodeIds = new Set()
  const delayedStartByNode = new Map()
  const delayedOffsetByNode = new Map()
  const waveOffsetByNode = new Map()
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (let index = 0; index < nodeIds.length; index += 1) {
    const nodeId = nodeIds[index]
    waveOffsetByNode.set(nodeId, BigInt(index % 4) * 900n)

    if (randomBool(random, 0.5)) {
      delayedNodeIds.add(nodeId)
      delayedStartByNode.set(nodeId, pickInt(random, 4, 8))
      delayedOffsetByNode.set(nodeId, BigInt(pickInt(random, 55_000, 120_000)))
    }
  }

  if (delayedNodeIds.size === 0 && nodeIds.length > 0) {
    delayedNodeIds.add(nodeIds[0])
    delayedStartByNode.set(nodeIds[0], 5)
    delayedOffsetByNode.set(nodeIds[0], 75_000n)
  }

  const events = baseEvents.map((event) => {
    const sequence = Number(event.sequence ?? 0n)
    const baseIngestedAt = event.ingestedAt ?? event.clock.physicalTimeMs
    const wave = BigInt(Math.floor((sequence - 1) / 3)) * 12_000n
    const nodeWaveOffset = waveOffsetByNode.get(event.nodeId) ?? 0n
    const delayedStart = delayedStartByNode.get(event.nodeId)
    const delayedOffset = delayedOffsetByNode.get(event.nodeId) ?? 0n
    const delayedReplay =
      delayedStart !== undefined &&
      event.sequence !== undefined &&
      event.sequence >= BigInt(delayedStart)

    return {
      ...event,
      ingestedAt: baseIngestedAt + wave + nodeWaveOffset + (delayedReplay ? delayedOffset : 0n),
      payload: {
        ...event.payload,
        fragmentedLateReplay: delayedReplay,
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
      .filter((event) => event.payload.fragmentedLateReplay === true)
      .map((event) => event.id),
  }
}

function applyCorrectionBurstNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x94d049bb)
  const delayedNodeIds = new Set()
  const delayedStartByNode = new Map()
  const backlogOffsetByNode = new Map()
  const burstOffsetByNode = new Map()
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (const nodeId of nodeIds) {
    if (randomBool(random, 0.65)) {
      delayedNodeIds.add(nodeId)
      delayedStartByNode.set(nodeId, pickInt(random, 3, 6))
      backlogOffsetByNode.set(nodeId, BigInt(pickInt(random, 120_000, 260_000)))
      burstOffsetByNode.set(nodeId, BigInt(pickInt(random, 1_500, 6_000)))
    }
  }

  if (delayedNodeIds.size === 0 && nodeIds.length > 0) {
    delayedNodeIds.add(nodeIds[0])
    delayedStartByNode.set(nodeIds[0], 4)
    backlogOffsetByNode.set(nodeIds[0], 180_000n)
    burstOffsetByNode.set(nodeIds[0], 3_000n)
  }

  const events = baseEvents.map((event) => {
    const baseIngestedAt = event.ingestedAt ?? event.clock.physicalTimeMs
    const delayedStart = delayedStartByNode.get(event.nodeId)
    const backlogOffset = backlogOffsetByNode.get(event.nodeId) ?? 0n
    const burstOffset = burstOffsetByNode.get(event.nodeId) ?? 0n
    const delayedReplay =
      delayedStart !== undefined &&
      event.sequence !== undefined &&
      event.sequence >= BigInt(delayedStart)

    const sequenceOffset = delayedReplay && event.sequence !== undefined
      ? (event.sequence - BigInt(delayedStart)) * burstOffset
      : 0n

    return {
      ...event,
      ingestedAt: baseIngestedAt + (delayedReplay ? backlogOffset + sequenceOffset : 0n),
      payload: {
        ...event.payload,
        correctionBurstReplay: delayedReplay,
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
      .filter((event) => event.payload.correctionBurstReplay === true)
      .map((event) => event.id),
  }
}

function applyReconnectBurstNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x2545f491)
  const delayedNodeIds = new Set()
  const delayedStartByNode = new Map()
  const backlogOffsetByNode = new Map()
  const burstWaveSizeByNode = new Map()
  const burstGapByNode = new Map()
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (const nodeId of nodeIds) {
    if (randomBool(random, 0.7)) {
      delayedNodeIds.add(nodeId)
      delayedStartByNode.set(nodeId, pickInt(random, 3, 6))
      backlogOffsetByNode.set(nodeId, BigInt(pickInt(random, 75_000, 150_000)))
      burstWaveSizeByNode.set(nodeId, pickInt(random, 2, 4))
      burstGapByNode.set(nodeId, BigInt(pickInt(random, 6_000, 18_000)))
    }
  }

  if (delayedNodeIds.size === 0 && nodeIds.length > 0) {
    delayedNodeIds.add(nodeIds[0])
    delayedStartByNode.set(nodeIds[0], 4)
    backlogOffsetByNode.set(nodeIds[0], 90_000n)
    burstWaveSizeByNode.set(nodeIds[0], 3)
    burstGapByNode.set(nodeIds[0], 9_000n)
  }

  const events = baseEvents.map((event) => {
    const baseIngestedAt = event.ingestedAt ?? event.clock.physicalTimeMs
    const delayedStart = delayedStartByNode.get(event.nodeId)
    const backlogOffset = backlogOffsetByNode.get(event.nodeId) ?? 0n
    const burstWaveSize = burstWaveSizeByNode.get(event.nodeId) ?? 3
    const burstGap = burstGapByNode.get(event.nodeId) ?? 9_000n
    const delayedReplay =
      delayedStart !== undefined &&
      event.sequence !== undefined &&
      event.sequence >= BigInt(delayedStart)

    let burstOffset = 0n
    if (delayedReplay && event.sequence !== undefined) {
      const reconnectIndex = Number(event.sequence - BigInt(delayedStart))
      const waveIndex = Math.floor(reconnectIndex / burstWaveSize)
      burstOffset = BigInt(waveIndex) * burstGap
    }

    return {
      ...event,
      ingestedAt: baseIngestedAt + (delayedReplay ? backlogOffset + burstOffset : 0n),
      payload: {
        ...event.payload,
        reconnectBurstReplay: delayedReplay,
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
      .filter((event) => event.payload.reconnectBurstReplay === true)
      .map((event) => event.id),
  }
}

function applyCorrectionChurnNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0xb5297a4d)
  const delayedNodeIds = new Set()
  const delayedStartByNode = new Map()
  const backlogOffsetByNode = new Map()
  const staggerOffsetByNode = new Map()
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (const nodeId of nodeIds) {
    if (randomBool(random, 0.8)) {
      delayedNodeIds.add(nodeId)
      delayedStartByNode.set(nodeId, pickInt(random, 2, 4))
      backlogOffsetByNode.set(nodeId, BigInt(pickInt(random, 150_000, 320_000)))
      staggerOffsetByNode.set(nodeId, BigInt(pickInt(random, 500, 2_000)))
    }
  }

  if (delayedNodeIds.size === 0 && nodeIds.length > 0) {
    delayedNodeIds.add(nodeIds[0])
    delayedStartByNode.set(nodeIds[0], 3)
    backlogOffsetByNode.set(nodeIds[0], 220_000n)
    staggerOffsetByNode.set(nodeIds[0], 1_000n)
  }

  const events = baseEvents.map((event) => {
    const baseIngestedAt = event.ingestedAt ?? event.clock.physicalTimeMs
    const delayedStart = delayedStartByNode.get(event.nodeId)
    const backlogOffset = backlogOffsetByNode.get(event.nodeId) ?? 0n
    const staggerOffset = staggerOffsetByNode.get(event.nodeId) ?? 0n
    const delayedReplay =
      delayedStart !== undefined &&
      event.sequence !== undefined &&
      event.sequence >= BigInt(delayedStart)

    const reconnectOffset = delayedReplay && event.sequence !== undefined
      ? (event.sequence - BigInt(delayedStart)) * staggerOffset
      : 0n

    return {
      ...event,
      ingestedAt: baseIngestedAt + (delayedReplay ? backlogOffset + reconnectOffset : 0n),
      payload: {
        ...event.payload,
        correctionChurnReplay: delayedReplay,
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
      .filter((event) => event.payload.correctionChurnReplay === true)
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

test("0.3.3 exploratory streaming fuzz keeps fragmented watermark-lag pressure reproducible across seeds", async () => {
  const seeds = [211, 307, 401, 503]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingPressureEvents({
      seed,
      deviceCount: 12,
      eventsPerDevice: 9,
    })
    const { events, delayedEventIds } = applyFragmentedWatermarkLagNoise(baseEvents, seed)
    const options = {
      batchSize: 5,
      maxLateArrivalMs: 50_000n,
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
        .filter((entry) => entry.event.payload.fragmentedLateReplay === true)
        .map((entry) => entry.event.id),
    )
    const nonFinalNonEmptyBatches = batches.filter((batch) =>
      batch.isFinal === false && (batch.events.length > 0 || batch.anomalies.length > 0),
    )

    assert.ok(delayedEventIds.length > 0, `expected delayed fragmented events for seed ${seed}`)
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
      `flag-mode output dropped fragmented late events for seed ${seed}`,
    )
    assert.ok(nonFinalNonEmptyBatches.length >= 3, `expected fragmented batches for seed ${seed}`)
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})

test("0.3.3 exploratory streaming fuzz keeps correction-burst pressure reproducible across seeds", async () => {
  const seeds = [223, 331, 419, 577]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingPressureEvents({
      seed,
      deviceCount: 10,
      eventsPerDevice: 11,
    })
    const { events, delayedEventIds } = applyCorrectionBurstNoise(baseEvents, seed)
    const options = {
      batchSize: 4,
      maxLateArrivalMs: 70_000n,
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

    assert.ok(delayedEventIds.length > 0, `expected delayed correction-burst events for seed ${seed}`)
    assertWatermarksMonotonic({ seed, batches })
    assertNodeSequencesMonotonic({ seed, batches })
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

test("0.3.3 correction-churn fuzz keeps sustained late-arrival correction pressure reproducible across seeds", async () => {
  const seeds = [601, 677, 761, 829]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingPressureEvents({
      seed,
      deviceCount: 14,
      eventsPerDevice: 14,
    })
    const { events, delayedEventIds } = applyCorrectionChurnNoise(baseEvents, seed)
    const options = {
      batchSize: 2,
      maxLateArrivalMs: 90_000n,
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
    const nonFinalNonEmptyBatches = batches.filter((batch) =>
      batch.isFinal === false && (batch.events.length > 0 || batch.anomalies.length > 0),
    )

    assert.ok(delayedEventIds.length >= 40, `expected heavy correction churn for seed ${seed}`)
    assertWatermarksMonotonic({ seed, batches })
    assertNodeSequencesMonotonic({ seed, batches })
    assert.equal(
      correctionBatches.length,
      delayedEventIds.length,
      `correction batch count changed for seed ${seed}`,
    )
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
    assert.ok(nonFinalNonEmptyBatches.length >= delayedEventIds.length, `expected fragmented churn batches for seed ${seed}`)
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})

test("0.3.3 reconnect-burst fuzz keeps fragmented replay pressure reproducible across seeds", async () => {
  const seeds = [613, 701, 787, 863]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingPressureEvents({
      seed,
      deviceCount: 16,
      eventsPerDevice: 12,
    })
    const { events, delayedEventIds } = applyReconnectBurstNoise(baseEvents, seed)
    const options = {
      batchSize: 3,
      maxLateArrivalMs: 60_000n,
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
        .filter((entry) => entry.event.payload.reconnectBurstReplay === true)
        .map((entry) => entry.event.id),
    )
    const reconnectBurstBatches = batches.filter((batch) =>
      batch.events.some((entry) => entry.event.payload.reconnectBurstReplay === true),
    )

    assert.ok(delayedEventIds.length >= 50, `expected reconnect burst backlog for seed ${seed}`)
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
      `reconnect burst output changed for seed ${seed}`,
    )
    assert.ok(reconnectBurstBatches.length >= 12, `expected fragmented reconnect batches for seed ${seed}`)
    assert.equal(
      batches.some((batch) => batch.correction !== undefined),
      false,
      `flag mode emitted correction metadata for seed ${seed}`,
    )
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})
