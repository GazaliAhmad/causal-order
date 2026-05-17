import { performance } from "node:perf_hooks"
import {
  getProfile,
  listProfileNames,
  runBenchmarkCase,
  runBenchmarkCaseAsync,
} from "./benchmark-lib.mjs"

function parseInteger(value, label) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }

  return parsed
}

function parseArgs(argv) {
  const args = [...argv]
  const options = {
    list: false,
    profiles: [],
    repeat: undefined,
    durationMs: undefined,
    pauseMs: 0,
    warmup: 1,
  }

  while (args.length > 0) {
    const current = args.shift()

    if (current === "--list") {
      options.list = true
      continue
    }

    if (current === "--profile") {
      const profile = args.shift()
      if (profile === undefined) {
        throw new Error("Missing profile name after --profile")
      }
      options.profiles.push(profile)
      continue
    }

    if (current === "--repeat") {
      const repeat = args.shift()
      if (repeat === undefined) {
        throw new Error("Missing value after --repeat")
      }
      options.repeat = parseInteger(repeat, "--repeat")
      continue
    }

    if (current === "--duration-ms") {
      const durationMs = args.shift()
      if (durationMs === undefined) {
        throw new Error("Missing value after --duration-ms")
      }
      options.durationMs = parseInteger(durationMs, "--duration-ms")
      continue
    }

    if (current === "--pause-ms") {
      const pauseMs = args.shift()
      if (pauseMs === undefined) {
        throw new Error("Missing value after --pause-ms")
      }
      options.pauseMs = parseInteger(pauseMs, "--pause-ms")
      continue
    }

    if (current === "--warmup") {
      const warmup = args.shift()
      if (warmup === undefined) {
        throw new Error("Missing value after --warmup")
      }
      options.warmup = parseInteger(warmup, "--warmup")
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return options
}

function formatMs(value) {
  return `${value.toFixed(2)} ms`
}

function formatMemory(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

function average(values) {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function min(values) {
  return values.reduce((current, value) => Math.min(current, value), Number.POSITIVE_INFINITY)
}

function max(values) {
  return values.reduce((current, value) => Math.max(current, value), Number.NEGATIVE_INFINITY)
}

function sleep(ms) {
  if (ms <= 0) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function runOne(profile) {
  if (profile.mode === "stream") {
    return runBenchmarkCaseAsync(profile)
  }

  return runBenchmarkCase(profile)
}

function printCycleSummary(index, run) {
  const parts = [
    `cycle ${String(index).padStart(2, "0")}`,
    `ordering ${formatMs(run.metrics.orderingMs)}`,
    `heap delta ${formatMemory(run.metrics.heapDeltaBytes)}`,
    `peak heap ${formatMemory(run.metrics.peakHeapUsedBytes)}`,
    `peak RSS ${formatMemory(run.metrics.peakRssBytes)}`,
    `GC ${run.metrics.gcCount}`,
    `anomalies ${run.metrics.anomalyCount}`,
  ]

  console.log(parts.join(" | "))
}

function printAggregateSummary(profile, runs, wallTimeMs, options) {
  const orderingMs = runs.map((run) => run.metrics.orderingMs)
  const heapDeltaBytes = runs.map((run) => run.metrics.heapDeltaBytes)
  const peakHeapBytes = runs.map((run) => run.metrics.peakHeapUsedBytes)
  const peakRssBytes = runs.map((run) => run.metrics.peakRssBytes)
  const startHeapBytes = runs.map((run) => run.metrics.startHeapUsedBytes)
  const endHeapBytes = runs.map((run) => run.metrics.endHeapUsedBytes)
  const gcCounts = runs.map((run) => run.metrics.gcCount)
  const gcDurationMs = runs.map((run) => run.metrics.gcDurationMs)
  const anomalyCounts = runs.map((run) => run.metrics.anomalyCount)

  console.log(`\n=== ${profile.name} endurance ===`)
  console.log(profile.description)
  if (profile.mode !== undefined) {
    console.log(`Mode: ${profile.mode}`)
  }
  console.log(`Warmup cycles: ${options.warmup}`)
  console.log(`Measured cycles: ${runs.length}`)
  if (options.repeat !== undefined) {
    console.log(`Repeat target: ${options.repeat}`)
  }
  if (options.durationMs !== undefined) {
    console.log(`Duration target: ${formatMs(options.durationMs)}`)
  }
  if (options.pauseMs > 0) {
    console.log(`Pause between cycles: ${formatMs(options.pauseMs)}`)
  }
  console.log(`Measured wall time: ${formatMs(wallTimeMs)}`)
  console.log(`Ordering avg/min/max: ${formatMs(average(orderingMs))} / ${formatMs(min(orderingMs))} / ${formatMs(max(orderingMs))}`)
  console.log(`Heap delta avg/min/max: ${formatMemory(average(heapDeltaBytes))} / ${formatMemory(min(heapDeltaBytes))} / ${formatMemory(max(heapDeltaBytes))}`)
  console.log(`Peak heap max: ${formatMemory(max(peakHeapBytes))}`)
  console.log(`Peak RSS max: ${formatMemory(max(peakRssBytes))}`)
  console.log(`Start heap first/last: ${formatMemory(startHeapBytes[0])} / ${formatMemory(startHeapBytes.at(-1))}`)
  console.log(`End heap first/last: ${formatMemory(endHeapBytes[0])} / ${formatMemory(endHeapBytes.at(-1))}`)
  console.log(`GC total/max per cycle: ${gcCounts.reduce((sum, value) => sum + value, 0)} / ${max(gcCounts)}`)
  console.log(`GC duration total/max per cycle: ${formatMs(gcDurationMs.reduce((sum, value) => sum + value, 0))} / ${formatMs(max(gcDurationMs))}`)
  console.log(`Anomalies total/max per cycle: ${anomalyCounts.reduce((sum, value) => sum + value, 0)} / ${max(anomalyCounts)}`)
}

async function runEnduranceProfile(profile, options) {
  for (let index = 0; index < options.warmup; index += 1) {
    await runOne(profile)
  }

  const runs = []
  const repeatTarget = options.repeat ?? (options.durationMs === undefined ? 10 : Number.POSITIVE_INFINITY)
  const durationTargetMs = options.durationMs ?? Number.POSITIVE_INFINITY
  const wallStart = performance.now()

  while (runs.length < repeatTarget) {
    const elapsedBeforeRun = performance.now() - wallStart
    if (runs.length > 0 && elapsedBeforeRun >= durationTargetMs) {
      break
    }

    const run = await runOne(profile)
    runs.push(run)
    printCycleSummary(runs.length, run)

    if (options.pauseMs > 0) {
      await sleep(options.pauseMs)
    }
  }

  const wallTimeMs = performance.now() - wallStart
  printAggregateSummary(profile, runs, wallTimeMs, options)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.list) {
    for (const name of listProfileNames()) {
      const profile = getProfile(name)
      console.log(`${profile.name}: ${profile.description}`)
    }
    return
  }

  const profileNames = options.profiles.length > 0
    ? options.profiles
    : ["streaming-150k-watermark-lag"]

  for (const name of profileNames) {
    const profile = getProfile(name)
    await runEnduranceProfile(profile, options)
  }
}

await main()
