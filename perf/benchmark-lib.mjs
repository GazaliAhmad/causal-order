import { mkdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { performance } from "node:perf_hooks"
import { orderEvents } from "../dist/index.js"

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

function summarizeAnomalies(result) {
  const counts = new Map()

  for (const anomaly of result.anomalies) {
    counts.set(anomaly.type, (counts.get(anomaly.type) ?? 0) + 1)
  }

  return Object.fromEntries(
    [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  )
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
  const generateEvent = createGenerator(profile)

  const generationStart = performance.now()
  const events = Array.from({ length: profile.totalEvents }, (_, index) => generateEvent(index))
  if (profile.shuffle) {
    shuffleInPlace(events)
  }
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
      orderedEvents: result.ordered.length,
      anomalyCount: result.anomalies.length,
      anomalyBreakdown: summarizeAnomalies(result),
      confidenceCounts: summarizeConfidence(result),
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

export function printBenchmarkSummary(run) {
  const { profile, metrics, sample } = run
  console.log(`\n=== ${profile.name} ===`)
  console.log(profile.description)
  console.log(`Generation + shuffle: ${formatMs(metrics.generationMs)}`)
  console.log(`Ordering: ${formatMs(metrics.orderingMs)}`)
  console.log(`Heap delta: ${formatMemory(metrics.heapDeltaBytes)}`)
  console.log(`Ordered events: ${metrics.orderedEvents.toLocaleString()}`)
  console.log(`Anomalies: ${metrics.anomalyCount.toLocaleString()}`)
  if (metrics.anomalyCount > 0) {
    console.log(`Anomaly breakdown: ${JSON.stringify(metrics.anomalyBreakdown)}`)
  }
  console.log(`Confidence counts: ${JSON.stringify(metrics.confidenceCounts)}`)
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
      "ordered_events",
      "anomaly_count",
      "anomaly_breakdown",
      "confidence_counts",
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
      run.metrics.orderedEvents,
      run.metrics.anomalyCount,
      JSON.stringify(run.metrics.anomalyBreakdown),
      JSON.stringify(run.metrics.confidenceCounts),
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
