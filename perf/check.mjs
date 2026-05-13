import {
  getProfile,
  printBenchmarkSummary,
  runBenchmarkCase,
  runBenchmarkCaseAsync,
} from "./benchmark-lib.mjs"

function formatMemory(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

const policies = [
  {
    profileName: "guard-10k-shuffled",
    description: "fast guardrail for obvious slowdowns in the smaller routine workload band",
    maxOrderingMs: 2_000,
    maxHeapDeltaBytes: 96 * 1024 * 1024,
    expectedOrderedEvents: 10_000,
    expectedAnomalyCount: 3_105,
  },
  {
    profileName: "guard-100k-shuffled-no-anomalies",
    description: "larger-batch guardrail for catastrophic regressions in the realistic upper-range batch target",
    maxOrderingMs: 6_000,
    maxHeapDeltaBytes: 256 * 1024 * 1024,
    expectedOrderedEvents: 100_000,
    expectedAnomalyCount: 0,
  },
  {
    profileName: "streaming-100k-plateaus",
    description: "streaming guardrail for the anomaly-free plateau benchmark so synthetic clock shapes do not silently drift",
    maxOrderingMs: 2_000,
    maxHeapDeltaBytes: 256 * 1024 * 1024,
    expectedOrderedEvents: 100_000,
    expectedAnomalyCount: 0,
  },
]

function assertPolicy(run, policy) {
  const failures = []

  if (run.metrics.orderingMs > policy.maxOrderingMs) {
    failures.push(
      `ordering time ${run.metrics.orderingMs.toFixed(2)} ms exceeded ${policy.maxOrderingMs} ms`,
    )
  }

  if (run.metrics.heapDeltaBytes > policy.maxHeapDeltaBytes) {
    failures.push(
      `heap delta ${formatMemory(run.metrics.heapDeltaBytes)} exceeded ${formatMemory(policy.maxHeapDeltaBytes)}`,
    )
  }

  if (run.metrics.orderedEvents !== policy.expectedOrderedEvents) {
    failures.push(
      `ordered events ${run.metrics.orderedEvents} did not match expected ${policy.expectedOrderedEvents}`,
    )
  }

  if (run.metrics.anomalyCount !== policy.expectedAnomalyCount) {
    failures.push(
      `anomaly count ${run.metrics.anomalyCount} did not match expected ${policy.expectedAnomalyCount}`,
    )
  }

  return failures
}

async function runWithWarmup(profileName) {
  const profile = getProfile(profileName)
  if (profile.mode === "stream") {
    await runBenchmarkCaseAsync(profile)
    return runBenchmarkCaseAsync(profile)
  }

  runBenchmarkCase(profile)
  return runBenchmarkCase(profile)
}

let failureCount = 0

for (const policy of policies) {
  const run = await runWithWarmup(policy.profileName)
  printBenchmarkSummary(run)
  console.log(`Perf policy: ${policy.description}`)

  const failures = assertPolicy(run, policy)
  if (failures.length > 0) {
    failureCount += 1
    console.error(`Perf guard failed for ${policy.profileName}`)
    for (const failure of failures) {
      console.error(`- ${failure}`)
    }
  } else {
    console.log(`Perf guard passed for ${policy.profileName}`)
  }
}

if (failureCount > 0) {
  process.exitCode = 1
}
