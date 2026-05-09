function createSeededRandom(seed = 0x5f3759df) {
  let state = seed >>> 0

  return function next() {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffleInPlace(items, random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = items[index]
    items[index] = items[swapIndex]
    items[swapIndex] = current
  }
}

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
  traceId,
  partition,
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
  if (traceId !== undefined) {
    event.traceId = traceId
  }
  if (partition !== undefined) {
    event.partition = partition
  }

  return event
}

function createRoutineStyleEvents({
  totalEvents,
  nodeCount,
  crossDependencyEvery = 25,
  dependencyFanIn = 1,
  includeSequence = true,
  includeParents = true,
  timeClusterSize = 1,
}) {
  const nodeSequences = Array.from({ length: nodeCount }, () => 0n)
  const nodeTimes = Array.from({ length: nodeCount }, (_, index) => 1_000n + BigInt(index))
  const lastEventIdByNode = Array.from({ length: nodeCount }, () => undefined)
  const events = []

  for (let index = 0; index < totalEvents; index += 1) {
    const nodeIndex = index % nodeCount
    const nodeId = createNodeId(nodeIndex)
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const physicalTimeMs = timeClusterSize > 1
      ? 1_000n + BigInt(Math.floor(index / timeClusterSize))
      : nodeTimes[nodeIndex] + 5n + BigInt((index * 17) % 7)
    if (timeClusterSize === 1) {
      nodeTimes[nodeIndex] = physicalTimeMs
    }

    const id = `evt-${index + 1}`
    const parentEventId = includeParents ? lastEventIdByNode[nodeIndex] : undefined
    const dependencyEventIds = []

    if (index >= nodeCount && crossDependencyEvery > 0 && index % crossDependencyEvery === 0) {
      for (let offset = 1; offset <= dependencyFanIn; offset += 1) {
        const dependencyNodeIndex = (nodeIndex + nodeCount - offset) % nodeCount
        const dependencyEventId = lastEventIdByNode[dependencyNodeIndex]
        if (dependencyEventId !== undefined) {
          dependencyEventIds.push(dependencyEventId)
        }
      }
    }

    lastEventIdByNode[nodeIndex] = id
    events.push(createEvent({
      id,
      nodeId,
      physicalTimeMs,
      logicalCounter: Number(sequence % 4n),
      payload: {
        type: index % 3 === 0 ? "write" : "read",
        region: nodeIndex % 2 === 0 ? "ap-southeast" : "us-east",
        value: index,
      },
      sequence: includeSequence ? sequence : undefined,
      parentEventId,
      dependencyEventIds: dependencyEventIds.length > 0 ? dependencyEventIds : undefined,
      ingestedAt: physicalTimeMs + BigInt(index % 11),
    }))
  }

  return events
}

function createDuplicateExplosionEvents(profile) {
  const uniqueCount = Math.max(profile.nodeCount * 4, Math.floor(profile.totalEvents * 0.58))
  const replayNodeCount = Math.max(4, Math.min(16, Math.floor(profile.nodeCount / 2) || 4))
  const replaySequences = Array.from({ length: replayNodeCount }, () => 0n)
  const events = createRoutineStyleEvents({
    totalEvents: uniqueCount,
    nodeCount: profile.nodeCount,
    crossDependencyEvery: 17,
    dependencyFanIn: 1,
    includeSequence: true,
    includeParents: true,
  })
  const duplicatesNeeded = profile.totalEvents - uniqueCount

  for (let index = 0; index < duplicatesNeeded; index += 1) {
    const source = events[(index * 13) % uniqueCount]
    const physicalTimeMs = source.clock.physicalTimeMs + 100_000n + BigInt(index)
    const replayNodeIndex = index % replayNodeCount
    const replayNodeId = `replay-${String(replayNodeIndex + 1).padStart(2, "0")}`
    const replaySequence = replaySequences[replayNodeIndex] + 1n
    replaySequences[replayNodeIndex] = replaySequence

    events.push(createEvent({
      id: source.id,
      nodeId: replayNodeId,
      physicalTimeMs,
      logicalCounter: source.clock.logicalCounter,
      payload: {
        type: "duplicate_explosion",
        duplicateOf: source.id,
        wave: Math.floor(index / 32),
      },
      sequence: replaySequence,
      ingestedAt: physicalTimeMs + BigInt(index % 7),
    }))
  }

  return events
}

function createInversionChainEvents(profile) {
  const random = createSeededRandom(profile.seed ?? 202)
  const chainLength = 5
  const events = []
  const baseTime = 2_000_000n + BigInt(profile.totalEvents)

  for (let index = 0; index < profile.totalEvents; index += 1) {
    const nodeIndex = index % profile.nodeCount
    const previousId = index % chainLength === 0 ? undefined : `evt-${index}`

    events.push(createEvent({
      id: `evt-${index + 1}`,
      nodeId: createNodeId(nodeIndex),
      physicalTimeMs: baseTime - BigInt(index),
      logicalCounter: index % 4,
      payload: {
        type: "inversion_chain",
        chain: Math.floor(index / chainLength),
      },
      parentEventId: previousId,
      ingestedAt: baseTime + BigInt(index),
    }))
  }

  shuffleInPlace(events, random)
  return events
}

function createMalformedRatioEvents(profile) {
  const random = createSeededRandom(profile.seed ?? 303)
  const events = createRoutineStyleEvents({
    totalEvents: profile.totalEvents,
    nodeCount: profile.nodeCount,
    crossDependencyEvery: 19,
    dependencyFanIn: 1,
    includeSequence: true,
    includeParents: true,
  }).map((event, index) => {
    const next = {
      ...event,
      clock: {
        ...event.clock,
      },
      payload: {
        ...event.payload,
        stress: "malformed_ratio",
      },
    }

    if (index % 9 === 0) {
      next.clock.physicalTimeMs = -1n - BigInt(index)
    } else if (index % 7 === 0) {
      delete next.sequence
    }

    if (index % 13 === 0) {
      next.parentEventId = `missing-parent-${index}`
    }

    return next
  })

  shuffleInPlace(events, random)
  return events
}

function createSparseCausalityEvents(profile) {
  const random = createSeededRandom(profile.seed ?? 404)
  const events = createRoutineStyleEvents({
    totalEvents: profile.totalEvents,
    nodeCount: profile.nodeCount,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    includeSequence: false,
    includeParents: false,
    timeClusterSize: 1,
  })

  for (let index = 0; index < events.length; index += 1) {
    if (index > 0 && index % 41 === 0) {
      events[index].dependencyEventIds = [events[index - 1].id]
    }

    if (index > profile.nodeCount && index % 67 === 0) {
      events[index].parentEventId = events[index - profile.nodeCount].id
    }
  }

  shuffleInPlace(events, random)
  return events
}

function createSameTimestampClusterEvents(profile) {
  const random = createSeededRandom(profile.seed ?? 505)
  const events = createRoutineStyleEvents({
    totalEvents: profile.totalEvents,
    nodeCount: profile.nodeCount,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    includeSequence: false,
    includeParents: false,
    timeClusterSize: 250,
  }).map((event, index) => ({
    ...event,
    clock: {
      ...event.clock,
    },
    payload: {
      ...event.payload,
      cluster: Math.floor(index / 250),
      type: "same_timestamp_cluster",
    },
    ingestedAt: event.clock.physicalTimeMs,
  }))

  shuffleInPlace(events, random)
  return events
}

function createReplayStormEvents(profile) {
  const events = []
  const storyCount = Math.floor(profile.totalEvents / 3)
  const rootSequences = Array.from({ length: profile.nodeCount }, () => 0n)

  for (let story = 0; story < storyCount; story += 1) {
    const rootNodeIndex = story % profile.nodeCount
    const childNodeIndex = (rootNodeIndex + 1) % profile.nodeCount
    const originalTime = 10_000n + BigInt(story * 3)
    const replayTime = originalTime + 50_000n
    const rootId = `evt-root-${story + 1}`
    const rootSequence = rootSequences[rootNodeIndex] + 1n
    rootSequences[rootNodeIndex] = rootSequence

    events.push(createEvent({
      id: rootId,
      nodeId: createNodeId(rootNodeIndex),
      physicalTimeMs: replayTime,
      logicalCounter: 0,
      payload: {
        type: "replay_root",
        story,
        kind: "replayed",
      },
      sequence: rootSequence,
      ingestedAt: replayTime,
    }))
    events.push(createEvent({
      id: `evt-child-${story + 1}`,
      nodeId: createNodeId(childNodeIndex),
      physicalTimeMs: originalTime + 1n,
      logicalCounter: 1,
      payload: {
        type: "replay_child",
        story,
      },
      parentEventId: rootId,
      ingestedAt: originalTime + 2n,
    }))
    events.push(createEvent({
      id: rootId,
      nodeId: createNodeId(rootNodeIndex),
      physicalTimeMs: originalTime,
      logicalCounter: 0,
      payload: {
        type: "replay_root",
        story,
        kind: "original",
      },
      sequence: rootSequence,
      ingestedAt: replayTime + 5n,
    }))
  }

  let fillerIndex = storyCount
  while (events.length < profile.totalEvents) {
    const nodeIndex = fillerIndex % profile.nodeCount
    const physicalTimeMs = 200_000n + BigInt(fillerIndex)
    events.push(createEvent({
      id: `evt-filler-${fillerIndex + 1}`,
      nodeId: createNodeId(nodeIndex),
      physicalTimeMs,
      logicalCounter: fillerIndex % 4,
      payload: {
        type: "replay_storm_filler",
      },
      sequence: BigInt((fillerIndex % 8) + 1),
      ingestedAt: physicalTimeMs + 1n,
    }))
    fillerIndex += 1
  }

  return events
}

function createCyclicDependencyEvents(profile) {
  const random = createSeededRandom(profile.seed ?? 606)
  const events = []
  const cycleGroups = Math.floor(profile.totalEvents / 3)

  for (let group = 0; group < cycleGroups; group += 1) {
    const baseIndex = group * 3
    const nodeA = createNodeId(baseIndex % profile.nodeCount)
    const nodeB = createNodeId((baseIndex + 1) % profile.nodeCount)
    const nodeC = createNodeId((baseIndex + 2) % profile.nodeCount)
    const idA = `evt-cycle-a-${group + 1}`
    const idB = `evt-cycle-b-${group + 1}`
    const idC = `evt-cycle-c-${group + 1}`
    const baseTime = 500_000n + BigInt(group * 2)

    events.push(createEvent({
      id: idA,
      nodeId: nodeA,
      physicalTimeMs: baseTime,
      logicalCounter: 0,
      payload: { type: "cycle_attempt", group, role: "a" },
      dependencyEventIds: [idC],
      ingestedAt: baseTime,
    }))
    events.push(createEvent({
      id: idB,
      nodeId: nodeB,
      physicalTimeMs: baseTime + 1n,
      logicalCounter: 1,
      payload: { type: "cycle_attempt", group, role: "b" },
      dependencyEventIds: [idA],
      ingestedAt: baseTime + 1n,
    }))
    events.push(createEvent({
      id: idC,
      nodeId: nodeC,
      physicalTimeMs: baseTime + 2n,
      logicalCounter: 2,
      payload: { type: "cycle_attempt", group, role: "c" },
      dependencyEventIds: [idB],
      ingestedAt: baseTime + 2n,
    }))
  }

  let fillerIndex = cycleGroups
  while (events.length < profile.totalEvents) {
    const physicalTimeMs = 700_000n + BigInt(fillerIndex)
    events.push(createEvent({
      id: `evt-cycle-filler-${fillerIndex + 1}`,
      nodeId: createNodeId(fillerIndex % profile.nodeCount),
      physicalTimeMs,
      logicalCounter: fillerIndex % 4,
      payload: { type: "cycle_filler" },
      ingestedAt: physicalTimeMs,
    }))
    fillerIndex += 1
  }

  shuffleInPlace(events, random)
  return events
}

function createSequenceConflictEvents(profile) {
  const events = []
  let batchIndex = 0
  let eventIndex = 1

  while (events.length < profile.totalEvents) {
    const nodeId = createNodeId(batchIndex % profile.nodeCount)
    const baseTime = 900_000n + BigInt(batchIndex * 10)
    const pattern = [
      { sequence: 2n, offset: 2n, kind: "leading_regression" },
      { sequence: 1n, offset: 1n, kind: "regressed" },
      { sequence: 3n, offset: 3n, kind: "first_conflict" },
      { sequence: 3n, offset: 4n, kind: "second_conflict" },
    ]

    for (const item of pattern) {
      if (events.length >= profile.totalEvents) {
        break
      }

      events.push(createEvent({
        id: `evt-seq-${eventIndex}`,
        nodeId,
        physicalTimeMs: baseTime + item.offset,
        logicalCounter: Number(item.sequence % 4n),
        payload: {
          type: "sequence_conflict",
          batch: batchIndex,
          kind: item.kind,
        },
        sequence: item.sequence,
        ingestedAt: baseTime + item.offset,
      }))
      eventIndex += 1
    }

    batchIndex += 1
  }

  return events
}

export function createStressEvents(profile) {
  switch (profile.stressKind) {
    case "duplicate_explosion":
      return createDuplicateExplosionEvents(profile)
    case "inversion_chain":
      return createInversionChainEvents(profile)
    case "malformed_ratio":
      return createMalformedRatioEvents(profile)
    case "sparse_causality":
      return createSparseCausalityEvents(profile)
    case "same_timestamp_cluster":
      return createSameTimestampClusterEvents(profile)
    case "replay_storm":
      return createReplayStormEvents(profile)
    case "cyclic_dependency":
      return createCyclicDependencyEvents(profile)
    case "sequence_conflict":
      return createSequenceConflictEvents(profile)
    default:
      throw new Error(`Unknown stress profile kind: ${profile.stressKind}`)
  }
}

export const stressBenchmarkProfiles = {
  "stress-150k-duplicate-explosion": {
    description: "150k events, duplicate explosion density stress, heavy duplicate-id pressure without mixed-noise corruption",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    stressKind: "duplicate_explosion",
    createEvents: createStressEvents,
  },
  "stress-150k-inversion-chains": {
    description: "150k events, inversion chain density stress, many parent-child relationships contradict HLC order",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    stressKind: "inversion_chain",
    createEvents: createStressEvents,
  },
  "stress-150k-malformed-ratios": {
    description: "150k events, malformed-event ratio stress, mixes invalid clocks with missing-sequence survivors",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    stressKind: "malformed_ratio",
    createEvents: createStressEvents,
  },
  "stress-150k-sparse-causality": {
    description: "150k events, sparse-causality stress, weak evidence graphs with only occasional explicit links",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    stressKind: "sparse_causality",
    createEvents: createStressEvents,
  },
  "stress-150k-same-timestamp-clusters": {
    description: "150k events, massive same-timestamp cluster stress, large deterministic tie cohorts with sparse evidence",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    stressKind: "same_timestamp_cluster",
    createEvents: createStressEvents,
  },
  "stress-150k-replay-storms": {
    description: "150k events, replay storm stress, repeated root replays force duplicate and inversion visibility",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    stressKind: "replay_storm",
    createEvents: createStressEvents,
  },
  "stress-150k-cyclic-dependencies": {
    description: "150k events, cyclic dependency attempt stress, unresolved causal loops stay visible without crashing",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    stressKind: "cyclic_dependency",
    createEvents: createStressEvents,
  },
  "stress-150k-sequence-conflicts": {
    description: "150k events, sequence conflict stress, repeated same-node regressions and duplicate sequence ownership",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    stressKind: "sequence_conflict",
    createEvents: createStressEvents,
  },
}
