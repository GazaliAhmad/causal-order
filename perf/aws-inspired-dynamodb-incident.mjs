import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { performance } from "node:perf_hooks"

import { ingestedAtWatermark, orderEventStream, orderEvents } from "../dist/index.js"
import { awsInspiredDynamoDbUsEast2015Fixture } from "../test/fixtures/aws-inspired-dynamodb-us-east-2015.mjs"

const DEFAULTS = {
  outDir: path.join("perf", "results", "aws-incident", "latest"),
  totalEvents: 1_000_000,
  batchSize: 256,
  maxLateArrivalMs: 120_000n,
  storageNodeCount: 20,
  delayedStorageNodeCount: 18,
  disruptionStartSequence: 2_400n,
  disruptionDurationSequenceWindow: 9_000n,
  duplicateEvery: 13n,
  invalidClockEvery: 31n,
  heapMb: undefined,
  forceGc: true,
}

const DEPENDENT_SERVICES = [
  {
    nodeId: "sqs",
    stalledType: "sqs.request_stalled",
    recoveryType: "dependent.recovery",
  },
  {
    nodeId: "autoscaling",
    stalledType: "autoscaling.health_delayed",
    recoveryType: "dependent.recovery",
  },
  {
    nodeId: "cloudwatch",
    stalledType: "cloudwatch.alarm_lagged",
    recoveryType: "dependent.recovery",
  },
  {
    nodeId: "aws-console",
    stalledType: "console.status_stale",
    recoveryType: "dependent.recovery",
  },
]

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }

  return parsed
}

function parsePositiveBigInt(value, label) {
  try {
    const parsed = BigInt(value)
    if (parsed <= 0n) {
      throw new Error()
    }
    return parsed
  } catch {
    throw new Error(`${label} must be a positive integer`)
  }
}

function parseArgs(argv) {
  const args = [...argv]
  const options = { ...DEFAULTS }

  while (args.length > 0) {
    const current = args.shift()

    if (current === "--out-dir") {
      const outDir = args.shift()
      if (outDir === undefined) {
        throw new Error("Missing value after --out-dir")
      }
      options.outDir = outDir
      continue
    }

    if (current === "--total-events") {
      const totalEvents = args.shift()
      if (totalEvents === undefined) {
        throw new Error("Missing value after --total-events")
      }
      options.totalEvents = parsePositiveInteger(totalEvents, "--total-events")
      continue
    }

    if (current === "--batch-size") {
      const batchSize = args.shift()
      if (batchSize === undefined) {
        throw new Error("Missing value after --batch-size")
      }
      options.batchSize = parsePositiveInteger(batchSize, "--batch-size")
      continue
    }

    if (current === "--max-late-arrival-ms") {
      const maxLateArrivalMs = args.shift()
      if (maxLateArrivalMs === undefined) {
        throw new Error("Missing value after --max-late-arrival-ms")
      }
      options.maxLateArrivalMs = parsePositiveBigInt(maxLateArrivalMs, "--max-late-arrival-ms")
      continue
    }

    if (current === "--heap-mb") {
      const heapMb = args.shift()
      if (heapMb === undefined) {
        throw new Error("Missing value after --heap-mb")
      }
      options.heapMb = parsePositiveInteger(heapMb, "--heap-mb")
      continue
    }

    if (current === "--no-force-gc") {
      options.forceGc = false
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return options
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
  return {
    id,
    nodeId,
    clock: {
      physicalTimeMs,
      logicalCounter,
      nodeId,
    },
    payload,
    ...(sequence !== undefined ? { sequence } : {}),
    ...(parentEventId !== undefined ? { parentEventId } : {}),
    ...(dependencyEventIds !== undefined && dependencyEventIds.length > 0
      ? { dependencyEventIds }
      : {}),
    ...(ingestedAt !== undefined ? { ingestedAt } : {}),
  }
}

function snapshotMemory(label) {
  const usage = process.memoryUsage()
  return {
    label,
    rssBytes: usage.rss,
    heapUsedBytes: usage.heapUsed,
    heapTotalBytes: usage.heapTotal,
    externalBytes: usage.external,
  }
}

function bytesToMiB(bytes) {
  return Number((bytes / (1024 * 1024)).toFixed(2))
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`
}

function formatMiB(bytes) {
  return `${bytesToMiB(bytes).toFixed(2)} MiB`
}

function addMapCount(map, key, increment = 1) {
  map.set(key, (map.get(key) ?? 0) + increment)
}

function toSortedObject(map) {
  return Object.fromEntries([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function toTopEntries(map, limit = 8) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function maybeForceGc(label, snapshots, enabled) {
  if (!enabled || typeof global.gc !== "function") {
    return false
  }

  global.gc()
  snapshots.push(snapshotMemory(label))
  return true
}

function createAwsInspiredState(options) {
  return {
    metadataSequence: 0n,
    lastMetadataEventId: undefined,
    storageSequences: Array.from({ length: options.storageNodeCount }, () => 0n),
    dependentSequences: Array.from({ length: DEPENDENT_SERVICES.length }, () => 0n),
    lastStorageEventIds: Array.from({ length: options.storageNodeCount }, () => undefined),
    lastDelayedStorageEventIds: Array.from({ length: options.delayedStorageNodeCount }, () => undefined),
    metadataMembershipOverloadedId: "metadata-membership-overloaded",
    metadataCapacityAddedId: "metadata-capacity-added",
    metadataCapacityAddedEmitted: false,
    recoveryMode: false,
    duplicateSourceByNode: new Map(),
  }
}

function createMetadataEvent(state, index) {
  state.metadataSequence += 1n
  const physicalTimeMs = 19_000n + BigInt(index) * 4n
  const isCapacityAdd = !state.metadataCapacityAddedEmitted && state.metadataSequence >= 2n
  const id = isCapacityAdd
    ? state.metadataCapacityAddedId
    : state.metadataSequence === 1n
      ? state.metadataMembershipOverloadedId
      : `metadata-service-evt-${state.metadataSequence}`

  if (isCapacityAdd) {
    state.metadataCapacityAddedEmitted = true
    state.recoveryMode = true
  }

  const event = createEvent({
    id,
    nodeId: "metadata-service",
    physicalTimeMs,
    logicalCounter: Number(state.metadataSequence % 4n),
    sequence: state.metadataSequence,
    parentEventId: state.lastMetadataEventId,
    payload: isCapacityAdd
      ? {
          type: "metadata.capacity_added",
          note: "capacity is restored before delayed storage history catches up",
        }
      : state.metadataSequence === 1n
        ? {
            type: "metadata.membership_overloaded",
            note: "membership fetches slow down after index metadata grows",
          }
        : {
            type: "metadata.status_heartbeat",
          },
    ingestedAt: physicalTimeMs + 5n,
  })

  state.lastMetadataEventId = event.id
  return event
}

function createDependentEvent(state, index) {
  const serviceIndex = index % DEPENDENT_SERVICES.length
  const service = DEPENDENT_SERVICES[serviceIndex]
  state.dependentSequences[serviceIndex] += 1n
  const sequence = state.dependentSequences[serviceIndex]
  const relatedStorageIndex = index % state.lastDelayedStorageEventIds.length
  const relatedStorageId = state.lastDelayedStorageEventIds[relatedStorageIndex] ?? state.metadataMembershipOverloadedId
  const stalled = !state.recoveryMode
  const payloadType = stalled ? service.stalledType : service.recoveryType
  const physicalTimeMs = 19_200n + BigInt(index) * 3n + BigInt(serviceIndex)

  return createEvent({
    id: `${service.nodeId}-evt-${sequence}`,
    nodeId: service.nodeId,
    physicalTimeMs,
    logicalCounter: Number(sequence % 4n),
    sequence,
    parentEventId: sequence > 1n ? `${service.nodeId}-evt-${sequence - 1n}` : undefined,
    dependencyEventIds: [relatedStorageId],
    payload: {
      type: payloadType,
      service: service.nodeId,
    },
    ingestedAt: physicalTimeMs + BigInt(serviceIndex + 7),
  })
}

function createStorageEvent(state, options, index) {
  const nodeIndex = index % options.storageNodeCount
  const nodeId = `storage-${String(nodeIndex + 1).padStart(2, "0")}`
  state.storageSequences[nodeIndex] += 1n
  let sequence = state.storageSequences[nodeIndex]
  const parentEventId = state.lastStorageEventIds[nodeIndex]
  const delayed = nodeIndex < options.delayedStorageNodeCount
  const inDisruptionWindow = delayed
    && sequence >= options.disruptionStartSequence
    && sequence < options.disruptionStartSequence + options.disruptionDurationSequenceWindow
  const recoverySequence = delayed
    && sequence === options.disruptionStartSequence + options.disruptionDurationSequenceWindow
  const postRecovery = delayed
    && sequence > options.disruptionStartSequence + options.disruptionDurationSequenceWindow
    && sequence < options.disruptionStartSequence + options.disruptionDurationSequenceWindow + 2_000n

  let payloadType = "storage.serve_requests"
  const dependencyEventIds = []

  if (sequence === options.disruptionStartSequence) {
    payloadType = "storage.self_disqualified"
    dependencyEventIds.push(state.metadataMembershipOverloadedId)
  } else if (inDisruptionWindow) {
    const mode = Number(sequence % 5n)
    payloadType = [
      "storage.membership_check",
      "storage.membership_timeout",
      "storage.membership_retry",
      "storage.self_disqualified",
      "storage.membership_probe",
    ][mode]
  } else if (recoverySequence) {
    payloadType = "storage.rejoin"
    dependencyEventIds.push(state.metadataCapacityAddedId)
    state.recoveryMode = true
  } else if (postRecovery) {
    payloadType = sequence % 2n === 0n
      ? "storage.rejoin"
      : "storage.serve_requests"
  }

  const physicalTimeMs = 5_000n + BigInt(index) * 5n + BigInt(nodeIndex)
  let logicalCounter = Number(sequence % 4n)
  if (inDisruptionWindow && sequence % options.invalidClockEvery === 0n) {
    logicalCounter = -1
  }

  let ingestedAt = physicalTimeMs + BigInt((index % 17) + 1)
  if (inDisruptionWindow || recoverySequence || postRecovery) {
    ingestedAt = physicalTimeMs + options.maxLateArrivalMs + 120_000n + BigInt(nodeIndex * 10)
  }

  let id = `${nodeId}-evt-${sequence}`
  if (inDisruptionWindow && sequence % options.duplicateEvery === 0n) {
    const duplicateId = state.duplicateSourceByNode.get(nodeIndex)
    if (duplicateId !== undefined) {
      id = duplicateId
    } else {
      state.duplicateSourceByNode.set(nodeIndex, id)
    }
  }

  const event = createEvent({
    id,
    nodeId,
    physicalTimeMs,
    logicalCounter,
    sequence,
    parentEventId,
    dependencyEventIds,
    payload: {
      type: payloadType,
      delayedNode: delayed,
      region: nodeIndex % 2 === 0 ? "us-east" : "us-west",
    },
    ingestedAt,
  })

  state.lastStorageEventIds[nodeIndex] = event.id
  if (delayed) {
    state.lastDelayedStorageEventIds[nodeIndex] = event.id
  }

  return event
}

async function* createAwsInspiredIncidentSource(options) {
  const state = createAwsInspiredState(options)

  for (let index = 0; index < options.totalEvents; index += 1) {
    if (index === 0) {
      yield createMetadataEvent(state, index)
      continue
    }

    const selector = index % 16
    if (selector === 0) {
      yield createMetadataEvent(state, index)
      continue
    }

    if (selector === 1 || selector === 2) {
      yield createDependentEvent(state, index)
      continue
    }

    yield createStorageEvent(state, options, index)
  }
}

async function runStreamIncident(options, memorySnapshots) {
  const anomalyBreakdown = new Map()
  const eventTypeBreakdown = new Map()
  const firstCorrectionTriggerEventIds = []
  let orderedEvents = 0
  let anomalyCount = 0
  let emittedBatches = 0
  let correctionBatches = 0
  let lateArrivalAnomalies = 0
  let finalBatches = 0
  let maxBatchEvents = 0
  let maxAnomaliesPerBatch = 0
  let lastWatermark = 0n

  const startedAt = performance.now()
  for await (const batch of orderEventStream(
    createAwsInspiredIncidentSource(options),
    {
      batchSize: options.batchSize,
      maxLateArrivalMs: options.maxLateArrivalMs,
      lateArrivalPolicy: "emit_correction",
      watermark: ingestedAtWatermark,
      strict: false,
    },
  )) {
    emittedBatches += 1
    if (batch.correction !== undefined) {
      correctionBatches += 1
      if (
        batch.correction.triggerEventId !== undefined
        && firstCorrectionTriggerEventIds.length < 5
      ) {
        firstCorrectionTriggerEventIds.push(batch.correction.triggerEventId)
      }
    }
    if (batch.isFinal) {
      finalBatches += 1
    }
    if (batch.events.length > maxBatchEvents) {
      maxBatchEvents = batch.events.length
    }
    if (batch.anomalies.length > maxAnomaliesPerBatch) {
      maxAnomaliesPerBatch = batch.anomalies.length
    }
    lastWatermark = batch.watermark

    for (const item of batch.events) {
      orderedEvents += 1
      const payloadType = item.event.payload?.type ?? "unknown"
      addMapCount(eventTypeBreakdown, String(payloadType))
    }

    for (const anomaly of batch.anomalies) {
      anomalyCount += 1
      addMapCount(anomalyBreakdown, anomaly.type)
      if (anomaly.type === "late_arrival") {
        lateArrivalAnomalies += 1
      }
    }
  }
  const runtimeMs = performance.now() - startedAt

  memorySnapshots.push(snapshotMemory("after_stream"))

  return {
    totalEventsRequested: options.totalEvents,
    runtimeMs,
    orderedEvents,
    anomalyCount,
    emittedBatches,
    correctionBatches,
    lateArrivalAnomalies,
    finalBatches,
    maxBatchEvents,
    maxAnomaliesPerBatch,
    lastWatermark: lastWatermark.toString(),
    firstCorrectionTriggerEventIds,
    anomalyBreakdown: toSortedObject(anomalyBreakdown),
    topEventTypes: toTopEntries(eventTypeBreakdown),
  }
}

function runReplaySlice(memorySnapshots) {
  const fixture = awsInspiredDynamoDbUsEast2015Fixture()
  const startedAt = performance.now()
  const result = orderEvents(fixture.reconnectReplayEvents, {
    strict: false,
    detectAnomalies: true,
  })
  const runtimeMs = performance.now() - startedAt
  memorySnapshots.push(snapshotMemory("after_replay"))

  const anomalyBreakdown = new Map()
  for (const anomaly of result.anomalies) {
    addMapCount(anomalyBreakdown, anomaly.type)
  }

  return {
    runtimeMs,
    orderedEvents: result.ordered.length,
    anomalyCount: result.anomalies.length,
    anomalyBreakdown: toSortedObject(anomalyBreakdown),
    duplicateVisible: result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"),
    invalidClockVisible: result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"),
    sequenceRegressionVisible: result.anomalies.some((anomaly) => anomaly.type === "sequence_regression"),
  }
}

function createMarkdownSummary(summary) {
  const lines = [
    "# Manual AWS Incident Confidence",
    "",
    "## Run",
    "",
    `- Node: \`${summary.environment.nodeVersion}\``,
    `- Platform: \`${summary.environment.platform}\``,
    `- Heap target: \`${summary.options.heapMb ?? "runner default"} MiB\``,
    `- Forced GC checkpoints: \`${summary.gc.forcedGcEnabled}\``,
    `- Total events requested: \`${summary.stream.totalEventsRequested.toLocaleString("en-US")}\``,
    "",
    "## Stream Result",
    "",
    `- Runtime: \`${formatMs(summary.stream.runtimeMs)}\``,
    `- Ordered events: \`${summary.stream.orderedEvents.toLocaleString("en-US")}\``,
    `- Anomalies: \`${summary.stream.anomalyCount.toLocaleString("en-US")}\``,
    `- Emitted batches: \`${summary.stream.emittedBatches.toLocaleString("en-US")}\``,
    `- Correction batches: \`${summary.stream.correctionBatches.toLocaleString("en-US")}\``,
    `- Late-arrival anomalies: \`${summary.stream.lateArrivalAnomalies.toLocaleString("en-US")}\``,
    `- Final batches: \`${summary.stream.finalBatches.toLocaleString("en-US")}\``,
    `- Max batch events: \`${summary.stream.maxBatchEvents.toLocaleString("en-US")}\``,
    `- Max anomalies in one batch: \`${summary.stream.maxAnomaliesPerBatch.toLocaleString("en-US")}\``,
    `- Last watermark: \`${summary.stream.lastWatermark}\``,
  ]

  if (summary.stream.firstCorrectionTriggerEventIds.length > 0) {
    lines.push("", "### First Correction Triggers", "")
    for (const id of summary.stream.firstCorrectionTriggerEventIds) {
      lines.push(`- \`${id}\``)
    }
  }

  lines.push("", "### Top Ordered Event Types", "")
  for (const entry of summary.stream.topEventTypes) {
    lines.push(`- \`${entry.key}\`: \`${entry.count.toLocaleString("en-US")}\``)
  }

  lines.push("", "### Stream Anomalies", "")
  for (const [key, count] of Object.entries(summary.stream.anomalyBreakdown)) {
    lines.push(`- \`${key}\`: \`${count.toLocaleString("en-US")}\``)
  }

  lines.push("", "## Replay Slice", "")
  lines.push(`- Runtime: \`${formatMs(summary.replay.runtimeMs)}\``)
  lines.push(`- Ordered events: \`${summary.replay.orderedEvents}\``)
  lines.push(`- Anomalies: \`${summary.replay.anomalyCount}\``)
  lines.push(`- Duplicate visible: \`${summary.replay.duplicateVisible}\``)
  lines.push(`- Invalid clock visible: \`${summary.replay.invalidClockVisible}\``)
  lines.push(`- Sequence regression visible: \`${summary.replay.sequenceRegressionVisible}\``)
  lines.push("", "## Memory Snapshots", "")

  for (const snapshot of summary.gc.memorySnapshots) {
    lines.push(
      `- \`${snapshot.label}\`: heapUsed=\`${snapshot.heapUsedMiB.toFixed(2)} MiB\`, heapTotal=\`${snapshot.heapTotalMiB.toFixed(2)} MiB\`, rss=\`${snapshot.rssMiB.toFixed(2)} MiB\``,
    )
  }

  return `${lines.join("\n")}\n`
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const memorySnapshots = []
  memorySnapshots.push(snapshotMemory("before_stream"))
  const forcedGcEnabled = maybeForceGc("before_stream_forced_gc", memorySnapshots, options.forceGc)

  const stream = await runStreamIncident(options, memorySnapshots)
  maybeForceGc("after_stream_forced_gc", memorySnapshots, options.forceGc)
  const replay = runReplaySlice(memorySnapshots)
  maybeForceGc("after_replay_forced_gc", memorySnapshots, options.forceGc)

  const summary = {
    generatedAt: new Date().toISOString(),
    options: {
      outDir: options.outDir,
      totalEvents: options.totalEvents,
      batchSize: options.batchSize,
      maxLateArrivalMs: options.maxLateArrivalMs.toString(),
      heapMb: options.heapMb,
    },
    environment: {
      nodeVersion: process.version,
      platform: `${process.platform}/${process.arch}`,
    },
    gc: {
      forcedGcEnabled,
      memorySnapshots: memorySnapshots.map((snapshot) => ({
        ...snapshot,
        rssMiB: bytesToMiB(snapshot.rssBytes),
        heapUsedMiB: bytesToMiB(snapshot.heapUsedBytes),
        heapTotalMiB: bytesToMiB(snapshot.heapTotalBytes),
        externalMiB: bytesToMiB(snapshot.externalBytes),
      })),
    },
    stream,
    replay,
  }

  const markdown = createMarkdownSummary(summary)

  await mkdir(options.outDir, { recursive: true })
  await writeFile(path.join(options.outDir, "summary.json"), JSON.stringify(summary, null, 2))
  await writeFile(path.join(options.outDir, "summary.md"), markdown)

  console.log(markdown)
  console.log(`Wrote AWS incident confidence summary to ${options.outDir}`)
}

await main()
