import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { performance } from "node:perf_hooks"
import { orderEventStream, orderEvents } from "../dist/index.js"
import { stressBenchmarkProfiles } from "./stress-profiles.mjs"

function createGenerator({
  nodeCount,
  crossDependencyEvery,
  dependencyFanIn,
}) {
  const nodeSequences = Array.from({ length: nodeCount }, () => 0n)
  const nodeTimes = Array.from({ length: nodeCount }, (_, index) => 1_000n + BigInt(index))
  const lastEventIdByNode = Array.from({ length: nodeCount }, () => undefined)

  return function generateEvent(index) {
    const nodeIndex = index % nodeCount
    const nodeId = `node-${String(nodeIndex + 1).padStart(2, "0")}`
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const physicalTimeMs = nodeTimes[nodeIndex] + 5n + BigInt((index * 17) % 7)
    nodeTimes[nodeIndex] = physicalTimeMs

    const id = `evt-${index + 1}`
    const parentEventId = lastEventIdByNode[nodeIndex]
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

    return {
      id,
      nodeId,
      clock: {
        physicalTimeMs,
        logicalCounter: Number(sequence % 4n),
        nodeId,
      },
      payload: {
        type: index % 3 === 0 ? "write" : "read",
        region: nodeIndex % 2 === 0 ? "ap-southeast" : "us-east",
        value: index,
      },
      sequence,
      parentEventId,
      dependencyEventIds: dependencyEventIds.length > 0 ? dependencyEventIds : undefined,
      ingestedAt: physicalTimeMs + BigInt(index % 11),
    }
  }
}

function shuffleInPlace(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = (index * 48271) % (index + 1)
    const current = items[index]
    items[index] = items[swapIndex]
    items[swapIndex] = current
  }
}

function createDefaultEvents(profile) {
  const generateEvent = createGenerator(profile)
  const events = Array.from({ length: profile.totalEvents }, (_, index) => generateEvent(index))
  if (profile.shuffle) {
    shuffleInPlace(events)
  }

  return events
}

function createStreamingPlateauEvents(profile) {
  const plateauSize = profile.plateauSize ?? 128
  const physicalTimeStepMs = profile.physicalTimeStepMs ?? 100n
  const nodeSequences = Array.from({ length: profile.nodeCount }, () => 0n)
  const lastEventIdByNode = Array.from({ length: profile.nodeCount }, () => undefined)

  return Array.from({ length: profile.totalEvents }, (_, index) => {
    const nodeIndex = index % profile.nodeCount
    const nodeId = `node-${String(nodeIndex + 1).padStart(2, "0")}`
    const sequence = nodeSequences[nodeIndex] + 1n
    nodeSequences[nodeIndex] = sequence

    const plateauIndex = Math.floor(index / plateauSize)
    const physicalTimeMs = 1_000n + BigInt(plateauIndex) * physicalTimeStepMs
    const id = `evt-${index + 1}`
    const parentEventId = lastEventIdByNode[nodeIndex]
    lastEventIdByNode[nodeIndex] = id

    return {
      id,
      nodeId,
      clock: {
        physicalTimeMs,
        logicalCounter: Number(sequence % 4n),
        nodeId,
      },
      payload: {
        type: index % 2 === 0 ? "stream" : "reconcile",
        plateauIndex,
        value: index,
      },
      sequence,
      parentEventId,
      ingestedAt: 1_000n + BigInt(index),
    }
  })
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`
}

function formatMemory(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function summarizeConfidence(result) {
  const counts = {
    proven: 0,
    derived: 0,
    fallback: 0,
    unknown: 0,
  }

  for (const item of result.ordered) {
    counts[item.confidence] += 1
  }

  return counts
}

function summarizeOrderBasis(result) {
  const counts = {
    causal: 0,
    hlc: 0,
    sequence: 0,
    deterministic_tiebreaker: 0,
    ingestion_order: 0,
  }

  for (const item of result.ordered) {
    counts[item.orderBasis] += 1
  }

  return counts
}

function summarizeAnomalies(result) {
  const counts = new Map()

  for (const anomaly of result.anomalies) {
    counts.set(anomaly.type, (counts.get(anomaly.type) ?? 0) + 1)
  }

  return Object.fromEntries(
    [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  )
}

function createConfidenceCounts() {
  return {
    proven: 0,
    derived: 0,
    fallback: 0,
    unknown: 0,
  }
}

function createOrderBasisCounts() {
  return {
    causal: 0,
    hlc: 0,
    sequence: 0,
    deterministic_tiebreaker: 0,
    ingestion_order: 0,
  }
}

function createSampleItem(item) {
  return {
    id: item.event.id,
    nodeId: item.event.nodeId,
    orderIndex: item.orderIndex.toString(),
    orderBasis: item.orderBasis,
    confidence: item.confidence,
  }
}

async function* createAsyncEventSource(events) {
  for (const event of events) {
    yield event
  }
}

async function runStreamingBenchmarkCase(profile, events, generationMs) {
  const memoryBefore = process.memoryUsage().heapUsed
  const orderingStart = performance.now()

  const confidenceCounts = createConfidenceCounts()
  const orderBasisCounts = createOrderBasisCounts()
  const anomalyBreakdown = new Map()
  const sample = []
  let orderedEvents = 0
  let anomalyCount = 0
  let batchCount = 0
  let finalBatchCount = 0
  let maxBatchEventCount = 0
  let lastWatermark = 0n

  for await (const batch of orderEventStream(
    createAsyncEventSource(events),
    profile.streamOptions,
  )) {
    batchCount += 1
    if (batch.isFinal) {
      finalBatchCount += 1
    }
    if (batch.events.length > maxBatchEventCount) {
      maxBatchEventCount = batch.events.length
    }
    lastWatermark = batch.watermark

    for (const item of batch.events) {
      orderedEvents += 1
      confidenceCounts[item.confidence] += 1
      orderBasisCounts[item.orderBasis] += 1
      if (sample.length < 5) {
        sample.push(createSampleItem(item))
      }
    }

    for (const anomaly of batch.anomalies) {
      anomalyCount += 1
      anomalyBreakdown.set(
        anomaly.type,
        (anomalyBreakdown.get(anomaly.type) ?? 0) + 1,
      )
    }
  }

  const orderingMs = performance.now() - orderingStart
  const memoryAfter = process.memoryUsage().heapUsed

  return {
    profile,
    metrics: {
      mode: "stream",
      totalEvents: profile.totalEvents,
      nodeCount: profile.nodeCount,
      detectAnomalies: profile.detectAnomalies,
      shuffle: profile.shuffle,
      crossDependencyEvery: profile.crossDependencyEvery,
      dependencyFanIn: profile.dependencyFanIn,
      generationMs,
      orderingMs,
      heapDeltaBytes: memoryAfter - memoryBefore,
      validEvents: orderedEvents,
      invalidEvents: 0,
      orderedEvents,
      anomalyCount,
      anomalyBreakdown: Object.fromEntries(
        [...anomalyBreakdown.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      ),
      confidenceCounts,
      orderBasisCounts,
      batchCount,
      finalBatchCount,
      maxBatchEventCount,
      lastWatermark: lastWatermark.toString(),
    },
    sample,
  }
}

export const benchmarkProfiles = {
  "guard-10k-shuffled": {
    description: "10k events, 16 nodes, anomalies on, shuffled input, intended for fast perf guardrails",
    totalEvents: 10_000,
    nodeCount: 16,
    detectAnomalies: true,
    shuffle: true,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "guard-100k-shuffled-no-anomalies": {
    description: "100k events, 32 nodes, anomalies off, shuffled input, intended for scale regression checks",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: true,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "baseline-100k-ordered": {
    description: "100k events, 32 nodes, anomalies on, ordered input",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: false,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "baseline-100k-shuffled": {
    description: "100k events, 32 nodes, anomalies on, shuffled input",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "baseline-150k-shuffled": {
    description: "150k events, 32 nodes, anomalies on, shuffled input, intended as a stretch visibility profile beyond the current 100k baseline promise",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: true,
    shuffle: true,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "baseline-100k-shuffled-no-anomalies": {
    description: "100k events, 32 nodes, anomalies off, shuffled input",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: true,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "guard-150k-shuffled-no-anomalies": {
    description: "150k events, 32 nodes, anomalies off, shuffled input, optional stretch guard profile not currently enforced in perf/check",
    totalEvents: 150_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: true,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  },
  "dense-deps-100k-shuffled": {
    description: "100k events, 16 nodes, anomalies on, shuffled input, denser cross-node dependencies",
    totalEvents: 100_000,
    nodeCount: 16,
    detectAnomalies: true,
    shuffle: true,
    crossDependencyEvery: 5,
    dependencyFanIn: 2,
  },
  "streaming-100k-plateaus": {
    description: "100k events, 32 nodes, anomaly-free streaming input with coarse watermark plateaus to measure ready-flush efficiency",
    mode: "stream",
    totalEvents: 100_000,
    nodeCount: 32,
    detectAnomalies: false,
    shuffle: false,
    crossDependencyEvery: 0,
    dependencyFanIn: 0,
    plateauSize: 128,
    physicalTimeStepMs: 100n,
    createEvents: createStreamingPlateauEvents,
    streamOptions: {
      batchSize: 4_096,
      maxLateArrivalMs: 1_000n,
      lateArrivalPolicy: "flag",
      strict: false,
      detectAnomalies: false,
    },
  },
  ...stressBenchmarkProfiles,
}

export function listProfileNames() {
  return Object.keys(benchmarkProfiles)
}

export function getProfile(name) {
  const profile = benchmarkProfiles[name]
  if (profile === undefined) {
    throw new Error(`Unknown benchmark profile: ${name}`)
  }

  return {
    name,
    ...profile,
  }
}

export function runBenchmarkCase(inputProfile) {
  const profile = typeof inputProfile === "string" ? getProfile(inputProfile) : inputProfile

  if (profile.mode === "stream") {
    throw new Error("Streaming benchmark profiles must be run through runBenchmarkCaseAsync")
  }

  const generationStart = performance.now()
  const events = profile.createEvents !== undefined
    ? profile.createEvents(profile)
    : createDefaultEvents(profile)
  const generationMs = performance.now() - generationStart

  const memoryBefore = process.memoryUsage().heapUsed
  const orderingStart = performance.now()
  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: profile.detectAnomalies,
  })
  const orderingMs = performance.now() - orderingStart
  const memoryAfter = process.memoryUsage().heapUsed

  return {
    profile,
    metrics: {
      totalEvents: profile.totalEvents,
      nodeCount: profile.nodeCount,
      detectAnomalies: profile.detectAnomalies,
      shuffle: profile.shuffle,
      crossDependencyEvery: profile.crossDependencyEvery,
      dependencyFanIn: profile.dependencyFanIn,
      generationMs,
      orderingMs,
      heapDeltaBytes: memoryAfter - memoryBefore,
      validEvents: result.stats.validEvents,
      invalidEvents: result.stats.invalidEvents,
      orderedEvents: result.ordered.length,
      anomalyCount: result.anomalies.length,
      anomalyBreakdown: summarizeAnomalies(result),
      confidenceCounts: summarizeConfidence(result),
      orderBasisCounts: summarizeOrderBasis(result),
    },
    sample: result.ordered.slice(0, 5).map((item) => ({
      id: item.event.id,
      nodeId: item.event.nodeId,
      orderIndex: item.orderIndex.toString(),
      orderBasis: item.orderBasis,
      confidence: item.confidence,
    })),
  }
}

export async function runBenchmarkCaseAsync(inputProfile) {
  const profile = typeof inputProfile === "string" ? getProfile(inputProfile) : inputProfile

  const generationStart = performance.now()
  const events = profile.createEvents !== undefined
    ? profile.createEvents(profile)
    : createDefaultEvents(profile)
  const generationMs = performance.now() - generationStart

  if (profile.mode === "stream") {
    return runStreamingBenchmarkCase(profile, events, generationMs)
  }

  const memoryBefore = process.memoryUsage().heapUsed
  const orderingStart = performance.now()
  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: profile.detectAnomalies,
  })
  const orderingMs = performance.now() - orderingStart
  const memoryAfter = process.memoryUsage().heapUsed

  return {
    profile,
    metrics: {
      mode: "batch",
      totalEvents: profile.totalEvents,
      nodeCount: profile.nodeCount,
      detectAnomalies: profile.detectAnomalies,
      shuffle: profile.shuffle,
      crossDependencyEvery: profile.crossDependencyEvery,
      dependencyFanIn: profile.dependencyFanIn,
      generationMs,
      orderingMs,
      heapDeltaBytes: memoryAfter - memoryBefore,
      validEvents: result.stats.validEvents,
      invalidEvents: result.stats.invalidEvents,
      orderedEvents: result.ordered.length,
      anomalyCount: result.anomalies.length,
      anomalyBreakdown: summarizeAnomalies(result),
      confidenceCounts: summarizeConfidence(result),
      orderBasisCounts: summarizeOrderBasis(result),
    },
    sample: result.ordered.slice(0, 5).map((item) => createSampleItem(item)),
  }
}

export function printBenchmarkSummary(run) {
  const { profile, metrics, sample } = run
  console.log(`\n=== ${profile.name} ===`)
  console.log(profile.description)
  if (metrics.mode !== undefined) {
    console.log(`Mode: ${metrics.mode}`)
  }
  console.log(`Generation + shuffle: ${formatMs(metrics.generationMs)}`)
  console.log(`Ordering: ${formatMs(metrics.orderingMs)}`)
  console.log(`Heap delta: ${formatMemory(metrics.heapDeltaBytes)}`)
  console.log(`Valid events: ${metrics.validEvents.toLocaleString()}`)
  console.log(`Invalid events: ${metrics.invalidEvents.toLocaleString()}`)
  console.log(`Ordered events: ${metrics.orderedEvents.toLocaleString()}`)
  console.log(`Anomalies: ${metrics.anomalyCount.toLocaleString()}`)
  if (metrics.batchCount !== undefined) {
    console.log(`Batches emitted: ${metrics.batchCount.toLocaleString()}`)
    console.log(`Final batches: ${metrics.finalBatchCount.toLocaleString()}`)
    console.log(`Max batch events: ${metrics.maxBatchEventCount.toLocaleString()}`)
    console.log(`Last watermark: ${metrics.lastWatermark}`)
  }
  if (metrics.anomalyCount > 0) {
    console.log(`Anomaly breakdown: ${JSON.stringify(metrics.anomalyBreakdown)}`)
  }
  console.log(`Confidence counts: ${JSON.stringify(metrics.confidenceCounts)}`)
  console.log(`Order basis counts: ${JSON.stringify(metrics.orderBasisCounts)}`)
  console.log("First 5 ordered events:")
  console.log(JSON.stringify(sample, null, 2))
}

function escapeCsv(value) {
  const text = String(value)
  if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
    return `"${text.replaceAll("\"", "\"\"")}"`
  }

  return text
}

export function toCsv(runs) {
  const rows = [
    [
      "profile",
      "description",
      "total_events",
      "node_count",
      "detect_anomalies",
      "shuffle",
      "cross_dependency_every",
      "dependency_fan_in",
      "generation_ms",
      "ordering_ms",
      "heap_delta_bytes",
      "valid_events",
      "invalid_events",
      "ordered_events",
      "anomaly_count",
      "anomaly_breakdown",
      "confidence_counts",
      "order_basis_counts",
    ],
  ]

  for (const run of runs) {
    rows.push([
      run.profile.name,
      run.profile.description,
      run.metrics.totalEvents,
      run.metrics.nodeCount,
      run.metrics.detectAnomalies,
      run.metrics.shuffle,
      run.metrics.crossDependencyEvery,
      run.metrics.dependencyFanIn,
      run.metrics.generationMs.toFixed(2),
      run.metrics.orderingMs.toFixed(2),
      run.metrics.heapDeltaBytes,
      run.metrics.validEvents,
      run.metrics.invalidEvents,
      run.metrics.orderedEvents,
      run.metrics.anomalyCount,
      JSON.stringify(run.metrics.anomalyBreakdown),
      JSON.stringify(run.metrics.confidenceCounts),
      JSON.stringify(run.metrics.orderBasisCounts),
    ])
  }

  return rows
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n")
}

export async function writeCsvFile(path, runs) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${toCsv(runs)}\n`, "utf8")
}
