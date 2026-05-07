import { runBenchmarkCase, printBenchmarkSummary } from "../perf/benchmark-lib.mjs"
import { isDirectRun } from "./_shared.mjs"

export function runBenchmark({
  totalEvents = 100_000,
  nodeCount = 32,
  detectAnomalies = true,
  shuffle = true,
} = {}) {
  const run = runBenchmarkCase({
    name: "custom-benchmark",
    description: "Custom one-off benchmark from examples/benchmark.mjs",
    totalEvents,
    nodeCount,
    detectAnomalies,
    shuffle,
    crossDependencyEvery: 25,
    dependencyFanIn: 1,
  })

  printBenchmarkSummary(run)
}

if (isDirectRun(import.meta.url)) {
  const totalEvents = Number.parseInt(process.argv[2] ?? "100000", 10)
  const nodeCount = Number.parseInt(process.argv[3] ?? "32", 10)
  const detectAnomalies = (process.argv[4] ?? "on").toLowerCase() !== "off"
  const shuffle = (process.argv[5] ?? "shuffle").toLowerCase() !== "ordered"

  runBenchmark({
    totalEvents,
    nodeCount,
    detectAnomalies,
    shuffle,
  })
}
