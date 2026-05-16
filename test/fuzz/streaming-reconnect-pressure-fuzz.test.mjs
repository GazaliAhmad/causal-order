import assert from "node:assert/strict"

import { ingestedAtWatermark } from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"
import {
  assertNodeSequencesMonotonic,
  assertStreamDeterminism,
  assertWatermarksMonotonic,
  collectStream,
  createBaseStreamingPressureEvents,
  createSeededRandom,
  pickInt,
  randomBool,
} from "./streaming-pressure-helpers.mjs"

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

    await assertStreamDeterminism({ seed, events, options })

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
    assert.deepEqual(lateArrivalIds, delayedEventIds, `late-arrival visibility changed for seed ${seed}`)
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

    await assertStreamDeterminism({ seed, events, options })

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
    assert.equal(correctionBatches.length, delayedEventIds.length, `correction batch count changed for seed ${seed}`)
    assert.deepEqual(
      correctionBatches.map((batch) => batch.correction?.triggerEventId),
      delayedEventIds,
      `correction triggers changed for seed ${seed}`,
    )
    assert.deepEqual(lateArrivalIds, delayedEventIds, `late-arrival visibility changed for seed ${seed}`)
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

    await assertStreamDeterminism({ seed, events, options })

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
    assert.deepEqual(lateArrivalIds, delayedEventIds, `late-arrival visibility changed for seed ${seed}`)
    assert.deepEqual(emittedDelayedIds, delayedEventIds, `reconnect burst output changed for seed ${seed}`)
    assert.ok(reconnectBurstBatches.length >= 12, `expected fragmented reconnect batches for seed ${seed}`)
    assert.equal(
      batches.some((batch) => batch.correction !== undefined),
      false,
      `flag mode emitted correction metadata for seed ${seed}`,
    )
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})
