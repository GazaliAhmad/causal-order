import assert from "node:assert/strict"

import { ingestedAtWatermark } from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"
import {
  assertAnomalyHorizonExplicit,
  assertNodeSequencesMonotonic,
  assertStreamDeterminism,
  assertWatermarksMonotonic,
  createBaseStreamingPressureEvents,
  createSeededRandom,
  collectStream,
  pickInt,
  randomBool,
} from "./streaming-pressure-helpers.mjs"

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

function applyBoundedWindowPressureNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x27d4eb2f)
  const delayedNodeIds = new Set()
  const delayedStartByNode = new Map()
  const delayedOffsetByNode = new Map()
  const waveGapByNode = new Map()
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (const nodeId of nodeIds) {
    if (randomBool(random, 0.75)) {
      delayedNodeIds.add(nodeId)
      delayedStartByNode.set(nodeId, pickInt(random, 7, 10))
      delayedOffsetByNode.set(nodeId, BigInt(pickInt(random, 90_000, 180_000)))
      waveGapByNode.set(nodeId, BigInt(pickInt(random, 4_000, 10_000)))
    }
  }

  if (delayedNodeIds.size === 0 && nodeIds.length > 0) {
    delayedNodeIds.add(nodeIds[0])
    delayedStartByNode.set(nodeIds[0], 8)
    delayedOffsetByNode.set(nodeIds[0], 120_000n)
    waveGapByNode.set(nodeIds[0], 6_000n)
  }

  const events = baseEvents.map((event) => {
    const baseIngestedAt = event.ingestedAt ?? event.clock.physicalTimeMs
    const delayedStart = delayedStartByNode.get(event.nodeId)
    const delayedOffset = delayedOffsetByNode.get(event.nodeId) ?? 0n
    const waveGap = waveGapByNode.get(event.nodeId) ?? 0n
    const delayedReplay =
      delayedStart !== undefined &&
      event.sequence !== undefined &&
      event.sequence >= BigInt(delayedStart)

    let extraWaveOffset = 0n
    if (delayedReplay && event.sequence !== undefined) {
      const reconnectIndex = Number(event.sequence - BigInt(delayedStart))
      extraWaveOffset = BigInt(Math.floor(reconnectIndex / 2)) * waveGap
    }

    return {
      ...event,
      ingestedAt: baseIngestedAt + (delayedReplay ? delayedOffset + extraWaveOffset : 0n),
      payload: {
        ...event.payload,
        boundedWindowReplay: delayedReplay,
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
      .filter((event) => event.payload.boundedWindowReplay === true)
      .map((event) => event.id),
  }
}

function applyCrossWindowReplayNoise(baseEvents, seed) {
  const random = createSeededRandom(seed ^ 0x165667b1)
  const selectedNodeIds = new Set()
  const replayDuplicates = []
  const nodeIds = [...new Set(baseEvents.map((event) => event.nodeId))]

  for (const nodeId of nodeIds) {
    if (randomBool(random, 0.45)) {
      selectedNodeIds.add(nodeId)
    }
  }

  if (selectedNodeIds.size === 0 && nodeIds.length > 0) {
    selectedNodeIds.add(nodeIds[0])
  }

  for (const event of baseEvents) {
    if (!selectedNodeIds.has(event.nodeId)) {
      continue
    }
    if (event.sequence === undefined || event.sequence < 2n || event.sequence > 4n) {
      continue
    }
    if (randomBool(random, 0.5)) {
      continue
    }

    replayDuplicates.push({
      ...event,
      ingestedAt: (event.ingestedAt ?? event.clock.physicalTimeMs) + BigInt(pickInt(random, 160_000, 280_000)),
      payload: {
        ...event.payload,
        crossWindowReplayDuplicate: true,
      },
    })
  }

  if (replayDuplicates.length === 0 && baseEvents.length > 0) {
    const fallback = baseEvents.find((event) => event.sequence === 2n) ?? baseEvents[0]
    replayDuplicates.push({
      ...fallback,
      ingestedAt: (fallback.ingestedAt ?? fallback.clock.physicalTimeMs) + 220_000n,
      payload: {
        ...fallback.payload,
        crossWindowReplayDuplicate: true,
      },
    })
  }

  const events = [...baseEvents, ...replayDuplicates]

  events.sort((a, b) => {
    const left = a.ingestedAt ?? a.clock.physicalTimeMs
    const right = b.ingestedAt ?? b.clock.physicalTimeMs

    if (left < right) return -1
    if (left > right) return 1
    return a.id.localeCompare(b.id)
  })

  return {
    events,
    replayedEventIds: events
      .filter((event) => event.payload.crossWindowReplayDuplicate === true)
      .map((event) => event.id),
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

    await assertStreamDeterminism({ seed, events, options })

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
    assert.deepEqual(lateArrivalIds, delayedEventIds, `late-arrival visibility changed for seed ${seed}`)
    assert.deepEqual(emittedDelayedIds, delayedEventIds, `flag-mode output dropped fragmented late events for seed ${seed}`)
    assert.ok(nonFinalNonEmptyBatches.length >= 3, `expected fragmented batches for seed ${seed}`)
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})

test("0.3.3 bounded-window fuzz keeps lagging-watermark partial-ready pressure reproducible across seeds", async () => {
  const seeds = [907, 971, 1031, 1093]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingPressureEvents({
      seed,
      deviceCount: 18,
      eventsPerDevice: 14,
    })
    const { events, delayedEventIds } = applyBoundedWindowPressureNoise(baseEvents, seed)
    const options = {
      batchSize: 2,
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
        .filter((entry) => entry.event.payload.boundedWindowReplay === true)
        .map((entry) => entry.event.id),
    )
    const activeBatches = batches.filter((batch) => batch.events.length > 0 || batch.anomalies.length > 0)
    const replayBatches = batches.filter((batch) =>
      batch.events.some((entry) => entry.event.payload.boundedWindowReplay === true),
    )

    assert.ok(delayedEventIds.length >= 70, `expected bounded-window delayed pressure for seed ${seed}`)
    assertWatermarksMonotonic({ seed, batches })
    assertNodeSequencesMonotonic({ seed, batches })
    assertAnomalyHorizonExplicit({ seed, batches: activeBatches })
    assert.deepEqual(lateArrivalIds, delayedEventIds, `late-arrival visibility changed for seed ${seed}`)
    assert.deepEqual(emittedDelayedIds, delayedEventIds, `bounded-window replay output changed for seed ${seed}`)
    assert.ok(replayBatches.length >= 20, `expected many replay batches for seed ${seed}`)
    assert.ok(activeBatches.length >= 60, `expected many active batches for seed ${seed}`)
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})

test("0.3.3 bounded-memory fuzz keeps cross-window replay limits explicit across seeds", async () => {
  const seeds = [1151, 1213, 1277, 1327]

  for (const seed of seeds) {
    const baseEvents = createBaseStreamingPressureEvents({
      seed,
      deviceCount: 12,
      eventsPerDevice: 10,
    })
    const { events, replayedEventIds } = applyCrossWindowReplayNoise(baseEvents, seed)
    const options = {
      batchSize: 3,
      maxLateArrivalMs: 50_000n,
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
    const emittedReplayIds = batches.flatMap((batch) =>
      batch.events
        .filter((entry) => entry.event.payload.crossWindowReplayDuplicate === true)
        .map((entry) => entry.event.id),
    )
    const anomalyTypes = new Set(batches.flatMap((batch) => batch.anomalies.map((anomaly) => anomaly.type)))
    const replayBatches = batches.filter((batch) =>
      batch.events.some((entry) => entry.event.payload.crossWindowReplayDuplicate === true),
    )

    assert.ok(replayedEventIds.length > 0, `expected cross-window replay duplicates for seed ${seed}`)
    assertWatermarksMonotonic({ seed, batches })
    assertAnomalyHorizonExplicit({ seed, batches })
    assert.deepEqual(lateArrivalIds, replayedEventIds, `late-arrival visibility changed for seed ${seed}`)
    assert.deepEqual(emittedReplayIds, replayedEventIds, `cross-window replay output changed for seed ${seed}`)
    assert.equal(anomalyTypes.has("duplicate_event"), false, `duplicate_event surfaced unexpectedly for seed ${seed}`)
    assert.equal(anomalyTypes.has("sequence_regression"), false, `sequence_regression surfaced unexpectedly for seed ${seed}`)
    assert.ok(replayBatches.length >= 1, `expected replay batches for seed ${seed}`)
    assert.equal(batches.at(-1)?.isFinal, true)
  }
})
