import { ingestedAtWatermark } from "../dist/index.js"

function createNodeId(index) {
  return `node-${String(index + 1).padStart(2, "0")}`
}

function createEvent({
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

function createReconnectPressureEvents(profile, options = {}) {
  const {
    delayedNodeRatio = 0.25,
    delayedStartSequence = 4n,
    reconnectDelayMs = 7_200_000n,
    duplicateEvery = 0,
    invalidEvery = 0,
  } = options

  const delayedNodeCount = Math.max(1, Math.floor(profile.nodeCount * delayedNodeRatio))
  const delayedNodeThreshold = profile.nodeCount - delayedNodeCount
  const nodeSequences = Array.from({ length: profile.nodeCount }, () => 0n)
  const nodeTimes = Array.from(
    { length: profile.nodeCount },
    (_, index) => 1_000_000n + BigInt(index * 10_000),
  )
  const lastEventIdByNode = Array.from({ length: profile.nodeCount }, () => undefined)
  const events = []

  for (let index = 0; index < profile.totalEvents; index += 1) {
    const nodeIndex = index % profile.nodeCount
    const nodeId = createNodeId(nodeIndex)
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const physicalTimeMs = nodeTimes[nodeIndex] + 250n + BigInt(index % 17)
    nodeTimes[nodeIndex] = physicalTimeMs

    const parentEventId = lastEventIdByNode[nodeIndex]
    const id = `${nodeId}-evt-${sequence}`
    lastEventIdByNode[nodeIndex] = id

    let ingestedAt = physicalTimeMs + BigInt(index % 19)
    const delayedNode = nodeIndex >= delayedNodeThreshold
    if (delayedNode && sequence >= delayedStartSequence) {
      ingestedAt += reconnectDelayMs + sequence * 3n
    }

    events.push(createEvent({
      id,
      nodeId,
      physicalTimeMs,
      logicalCounter: Number(sequence % 4n),
      payload: {
        type: delayedNode ? "reconnect" : "live",
        pressureKind: profile.streamStressKind,
        delayedNode,
      },
      sequence,
      parentEventId,
      ingestedAt,
    }))
  }

  events.sort((a, b) => {
    if (a.ingestedAt < b.ingestedAt) return -1
    if (a.ingestedAt > b.ingestedAt) return 1
    return a.id.localeCompare(b.id)
  })

  if (duplicateEvery > 0) {
    const duplicateCopies = []
    for (let index = duplicateEvery - 1; index < events.length; index += duplicateEvery) {
      const source = events[index]
      duplicateCopies.push({
        ...source,
        payload: {
          ...source.payload,
          duplicateReplay: true,
        },
        ingestedAt: (source.ingestedAt ?? source.clock.physicalTimeMs) + 1n,
      })
    }
    events.push(...duplicateCopies)
    events.sort((a, b) => {
      if (a.ingestedAt < b.ingestedAt) return -1
      if (a.ingestedAt > b.ingestedAt) return 1
      return a.id.localeCompare(b.id)
    })
  }

  if (invalidEvery > 0) {
    for (let index = invalidEvery - 1; index < events.length; index += invalidEvery) {
      events[index] = {
        ...events[index],
        clock: {
          ...events[index].clock,
          logicalCounter: -1,
        },
        payload: {
          ...events[index].payload,
          invalidReplay: true,
        },
      }
    }
  }

  return events
}

function createWatermarkLagEvents(profile) {
  const plateauSize = profile.plateauSize ?? 1_024
  const physicalTimeStepMs = profile.physicalTimeStepMs ?? 2_048n
  const nodeSequences = Array.from({ length: profile.nodeCount }, () => 0n)
  const nodeLogicalCounters = Array.from({ length: profile.nodeCount }, () => 0)
  const lastPhysicalTimeByNode = Array.from({ length: profile.nodeCount }, () => undefined)
  const lastEventIdByNode = Array.from({ length: profile.nodeCount }, () => undefined)

  return Array.from({ length: profile.totalEvents }, (_, index) => {
    const nodeIndex = index % profile.nodeCount
    const nodeId = createNodeId(nodeIndex)
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const plateauIndex = Math.floor(index / plateauSize)
    const physicalTimeMs = 50_000n + BigInt(plateauIndex) * physicalTimeStepMs
    const previousPhysicalTimeMs = lastPhysicalTimeByNode[nodeIndex]
    const logicalCounter = previousPhysicalTimeMs === physicalTimeMs
      ? nodeLogicalCounters[nodeIndex] + 1
      : 0
    nodeLogicalCounters[nodeIndex] = logicalCounter
    lastPhysicalTimeByNode[nodeIndex] = physicalTimeMs
    const parentEventId = lastEventIdByNode[nodeIndex]
    const id = `${nodeId}-evt-${sequence}`
    lastEventIdByNode[nodeIndex] = id

    return createEvent({
      id,
      nodeId,
      physicalTimeMs,
      logicalCounter,
      payload: {
        type: "watermark_lag",
        pressureKind: profile.streamStressKind,
        plateauIndex,
      },
      sequence,
      parentEventId,
      ingestedAt: physicalTimeMs + BigInt(index % 7),
    })
  })
}

function createFragmentedReadySubsetEvents(profile) {
  const maxLateArrivalMs = profile.streamOptions?.maxLateArrivalMs ?? 100n
  const laggingOffset = -maxLateArrivalMs
  const leadingOffset = 400n
  const laggingNodeCount = Math.max(1, Math.floor(profile.nodeCount / 2))
  const nodeSequences = Array.from({ length: profile.nodeCount }, () => 0n)
  const lastEventIdByNode = Array.from({ length: profile.nodeCount }, () => undefined)

  return Array.from({ length: profile.totalEvents }, (_, index) => {
    const nodeIndex = index % profile.nodeCount
    const nodeId = createNodeId(nodeIndex)
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const ingestedAt = 200_000n + BigInt(index)
    const offset = nodeIndex < laggingNodeCount ? laggingOffset : leadingOffset
    const physicalTimeMs = ingestedAt + offset
    const parentEventId = lastEventIdByNode[nodeIndex]
    const id = `${nodeId}-evt-${sequence}`
    lastEventIdByNode[nodeIndex] = id

    return createEvent({
      id,
      nodeId,
      physicalTimeMs,
      logicalCounter: Number(sequence % 4n),
      payload: {
        type: "fragmented_ready_subset",
        pressureKind: profile.streamStressKind,
        bucket: nodeIndex < laggingNodeCount ? "ready_edge" : "future_pending",
      },
      sequence,
      parentEventId,
      ingestedAt,
    })
  })
}

export function createStreamStressEvents(profile) {
  switch (profile.streamStressKind) {
    case "correction_churn":
      return createReconnectPressureEvents(profile, {
        delayedNodeRatio: 0.35,
        delayedStartSequence: 3n,
        reconnectDelayMs: 10_800_000n,
      })
    case "watermark_lag":
      return createWatermarkLagEvents(profile)
    case "fragmented_ready_subset":
      return createFragmentedReadySubsetEvents(profile)
    case "anomaly_heavy_reconnect_backlog":
      return createReconnectPressureEvents(profile, {
        delayedNodeRatio: 0.4,
        delayedStartSequence: 4n,
        reconnectDelayMs: 14_400_000n,
        duplicateEvery: 17,
        invalidEvery: 29,
      })
    default:
      throw new Error(`Unknown stream stress profile kind: ${profile.streamStressKind}`)
  }
}

export const streamStressBenchmarkProfiles = {
  "streaming-100k-correction-churn": {
    description: "100k events, correction-churn streaming pressure with reconnect-delayed nodes repeatedly forcing emit_correction flushes",
    mode: "stream",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "correction_churn",
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 256,
      maxLateArrivalMs: 30_000n,
      lateArrivalPolicy: "emit_correction",
      watermark: ingestedAtWatermark,
      strict: false,
      detectAnomalies: true,
    },
  },
  "streaming-150k-correction-churn": {
    description: "150k events, sustained correction-churn streaming pressure with reconnect-delayed nodes repeatedly forcing emit_correction flushes over a longer runtime band",
    mode: "stream",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "correction_churn",
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 256,
      maxLateArrivalMs: 30_000n,
      lateArrivalPolicy: "emit_correction",
      watermark: ingestedAtWatermark,
      strict: false,
      detectAnomalies: true,
    },
  },
  "streaming-100k-watermark-lag": {
    description: "100k events, sustained watermark-lag streaming pressure with long coarse plateaus and delayed flush readiness",
    mode: "stream",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "watermark_lag",
    plateauSize: 1_024,
    physicalTimeStepMs: 2_048n,
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 1_024,
      maxLateArrivalMs: 8_192n,
      lateArrivalPolicy: "flag",
      strict: false,
      detectAnomalies: false,
    },
  },
  "streaming-150k-watermark-lag": {
    description: "150k events, sustained watermark-lag streaming pressure, intended as the main 0.3.3 stream stress-visibility band beyond the routine 100k baseline",
    mode: "stream",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "watermark_lag",
    plateauSize: 1_024,
    physicalTimeStepMs: 2_048n,
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 1_024,
      maxLateArrivalMs: 8_192n,
      lateArrivalPolicy: "flag",
      strict: false,
      detectAnomalies: false,
    },
  },
  "streaming-250k-watermark-lag": {
    description: "250k events, sustained watermark-lag streaming pressure, intended as an exploratory stretch profile rather than a routine guardrail",
    mode: "stream",
    totalEvents: 250_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "watermark_lag",
    plateauSize: 1_024,
    physicalTimeStepMs: 2_048n,
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 1_024,
      maxLateArrivalMs: 8_192n,
      lateArrivalPolicy: "flag",
      strict: false,
      detectAnomalies: false,
    },
  },
  "streaming-100k-fragmented-ready": {
    description: "100k events, fragmented ready-subset streaming pressure with ingested-at watermark progress and future-pending cohorts",
    mode: "stream",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "fragmented_ready_subset",
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 128,
      maxLateArrivalMs: 100n,
      lateArrivalPolicy: "flag",
      watermark: ingestedAtWatermark,
      strict: false,
      detectAnomalies: false,
    },
  },
  "streaming-100k-anomaly-heavy-reconnect": {
    description: "100k events, anomaly-heavy reconnect backlog pressure mixing delayed uploads, duplicate replays, and invalid clock survivors",
    mode: "stream",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "anomaly_heavy_reconnect_backlog",
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 256,
      maxLateArrivalMs: 45_000n,
      lateArrivalPolicy: "flag",
      watermark: ingestedAtWatermark,
      strict: false,
      detectAnomalies: true,
    },
  },
  "streaming-150k-anomaly-heavy-reconnect": {
    description: "150k events, sustained anomaly-heavy reconnect backlog pressure mixing delayed uploads, duplicate replays, and invalid clock survivors over a longer runtime band",
    mode: "stream",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    streamStressKind: "anomaly_heavy_reconnect_backlog",
    createEvents: createStreamStressEvents,
    streamOptions: {
      batchSize: 256,
      maxLateArrivalMs: 45_000n,
      lateArrivalPolicy: "flag",
      watermark: ingestedAtWatermark,
      strict: false,
      detectAnomalies: true,
    },
  },
}
