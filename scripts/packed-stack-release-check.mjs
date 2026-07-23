import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const evidenceRoot = path.join(repoRoot, ".local", "v1.0.x", "v1.0.1", "packed-stack")
const consumerRoot = path.join(evidenceRoot, "consumer")
const packRoot = path.join(evidenceRoot, "pack")
const cacheRoot = path.join(evidenceRoot, "npm-cache")
const artifactsRoot = path.join(evidenceRoot, "artifacts")
const qualificationProfilePath = path.join(evidenceRoot, "qualification-profile.json")
const dedupeConfigPath = path.join(evidenceRoot, "dedupe-config.json")
const testingSpec = process.env.CAUSAL_ORDER_TESTING_SPEC ?? "@causal-order/testing@0.3.1"

const expectedVersions = {
  "causal-order": "1.0.1",
  "@causal-order/transport": "0.2.0",
  "@causal-order/monitor": "0.6.0",
  "@causal-order/dedupe": "1.2.0",
  "@causal-order/testing": "0.3.1",
}

await resetEvidenceDirectory()
await writeQualificationProfile()
await writeDedupeConfig()

const packResult = runNpm([
  "pack",
  "--json",
  "--silent",
  "--pack-destination",
  packRoot,
  "--cache",
  cacheRoot,
], repoRoot)
const packRecords = parseJsonArray(packResult.stdout, "npm pack")
const fileName = packRecords[0]?.filename
assert.equal(typeof fileName, "string", "npm pack did not report a tarball")
const tarballPath = path.join(packRoot, fileName)
const tarballSha256 = createHash("sha256")
  .update(await readFile(tarballPath))
  .digest("hex")

await writeFile(
  path.join(consumerRoot, "package.json"),
  `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  "utf8",
)

runNpm([
  "install",
  "--ignore-scripts",
  "--no-audit",
  "--no-fund",
  "--save-exact",
  "--cache",
  cacheRoot,
  tarballPath,
  "@causal-order/transport@0.2.0",
  "@causal-order/monitor@0.6.0",
  "@causal-order/dedupe@1.2.0",
  testingSpec,
], consumerRoot)

const installedVersions = {}
for (const [packageName, expectedVersion] of Object.entries(expectedVersions)) {
  const manifest = JSON.parse(
    await readFile(installedManifestPath(packageName), "utf8"),
  )
  installedVersions[packageName] = manifest.version
  assert.equal(
    manifest.version,
    expectedVersion,
    `${packageName} must resolve to ${expectedVersion}`,
  )
}

const candidateManifest = JSON.parse(
  await readFile(installedManifestPath("causal-order"), "utf8"),
)
assert.deepEqual(candidateManifest.dependencies ?? {}, {})

const identityScript = path.join(consumerRoot, "candidate-identity.mjs")
await writeFile(
  identityScript,
  `import assert from "node:assert/strict"\nimport { orderEvents } from "causal-order"\nassert.equal(typeof orderEvents, "function")\n`,
  "utf8",
)
run(process.execPath, [identityScript], consumerRoot)

const scenarios = [
  {
    id: "monitor-healthy-rolling-4h",
    profile: "monitor-healthy-rolling-4h",
    verdict: "pass",
  },
  {
    id: "monitor-order-outage",
    profile: "monitor-order-outage",
    verdict: "pass",
  },
  {
    id: "monitor-order-outage",
    runName: "monitor-order-outage-repeat-2",
    profile: "monitor-order-outage",
    verdict: "pass",
  },
  {
    id: "monitor-transport-outage-burst",
    profile: "monitor-transport-outage-burst",
    verdict: "pass",
  },
  {
    id: "monitor-dedupe-outage",
    profile: "monitor-dedupe-bypass",
    verdict: "pass_with_expected_degradation",
  },
  {
    id: "monitor-replay-retry-backoff",
    profile: "monitor-replay-retry-backoff",
    verdict: "pass",
  },
  {
    id: "monitor-dual-outage",
    profile: "monitor-dual-outage",
    verdict: "pass",
  },
]

const scenarioEvidence = []
for (const scenario of scenarios) {
  const result = runScenario({
    id: scenario.id,
    runName: scenario.runName,
    duration: "20m",
    steadyFor: "4m",
    expectSuccess: true,
  })
  const summary = JSON.parse(await readFile(result.summaryPath, "utf8"))
  assertScenarioContract(summary, scenario)
  scenarioEvidence.push(summarizeScenario(summary))
}

const negative = runScenario({
  id: "monitor-order-outage",
  duration: "30s",
  steadyFor: "0s",
  runName: "negative-control",
  expectSuccess: false,
})
const negativeSummary = JSON.parse(await readFile(negative.summaryPath, "utf8"))
assert.equal(negative.result.status, 1, "negative control must exit with status 1")
assert.equal(negativeSummary.outcome.verdict, "fail_contract")
assert.ok(
  negativeSummary.outcome.verdictReasons.length > 0,
  "negative control must retain contract failure reasons",
)

const npmLs = runNpm(["ls", "--all", "--json"], consumerRoot)
await writeFile(path.join(evidenceRoot, "npm-ls.json"), npmLs.stdout, "utf8")

const evidence = {
  schema: "causal-order/packed-stack-release-check",
  version: 1,
  candidate: {
    fileName,
    sha256: tarballSha256,
    npmIntegrity: packRecords[0]?.integrity ?? null,
    npmShasum: packRecords[0]?.shasum ?? null,
  },
  installedVersions,
  environment: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  scenarios: scenarioEvidence,
  negativeControl: {
    verdict: negativeSummary.outcome.verdict,
    reasons: negativeSummary.outcome.verdictReasons,
    exitStatus: negative.result.status,
  },
}
await writeFile(
  path.join(evidenceRoot, "release-evidence.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
)

process.stdout.write(
  `Packed stack release check passed for ${fileName} (${tarballSha256.slice(0, 12)}) on ${process.version}.\n`,
)

async function resetEvidenceDirectory() {
  const expectedRoot = path.join(repoRoot, ".local", "v1.0.x", "v1.0.1", "packed-stack")
  assert.equal(evidenceRoot, expectedRoot)
  await rm(evidenceRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  await Promise.all([
    mkdir(consumerRoot, { recursive: true }),
    mkdir(packRoot, { recursive: true }),
    mkdir(cacheRoot, { recursive: true }),
    mkdir(artifactsRoot, { recursive: true }),
  ])
}

async function writeQualificationProfile() {
  const profile = {
    name: "causal-order-v1.0.1-release-ci",
    description: "Bounded low-latency workload for deterministic packed-stack release qualification.",
    phaseRates: {
      steadyEventsPerSecond: 2,
      chaosMultiplier: 1.2,
      chaosJitterMin: 1,
      chaosJitterMax: 1,
    },
    duplicates: {
      steadyChance: 0.02,
      chaoticChance: 0.05,
    },
    delays: {
      steady: {
        baseMinMs: 1,
        baseMaxMs: 2,
        spikeChance: 0,
        spikeMinMs: 2,
        spikeMaxMs: 2,
      },
      chaotic: {
        baseMinMs: 1,
        baseMaxMs: 3,
        slowSpikeChance: 0,
        slowSpikeMinMs: 3,
        slowSpikeMaxMs: 3,
        lateSpikeChance: 0,
        lateSpikeMinMs: 3,
        lateSpikeMaxMs: 3,
        extremeSpikeChance: 0,
        extremeSpikeMinMs: 3,
        extremeSpikeMaxMs: 3,
      },
    },
  }
  await writeFile(
    qualificationProfilePath,
    `${JSON.stringify(profile, null, 2)}\n`,
    "utf8",
  )
}

async function writeDedupeConfig() {
  const config = {
    slidingWindowSeconds: 1800,
    maxSlidingWindowSeconds: 1800,
    autoCleanup: true,
    autoCleanupIntervalSeconds: 30,
  }
  await writeFile(
    dedupeConfigPath,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  )
}

function installedManifestPath(packageName) {
  return path.join(consumerRoot, "node_modules", ...packageName.split("/"), "package.json")
}

function runScenario({ id, duration, steadyFor, runName = id, expectSuccess }) {
  const scenarioRoot = path.join(artifactsRoot, runName)
  const summaryPath = path.join(scenarioRoot, "summary.json")
  const executable = path.join(
    consumerRoot,
    "node_modules",
    "@causal-order",
    "testing",
    "bin",
    "causal-order-testing-adapter-runtime.js",
  )
  const args = [
    executable,
    "--adapter",
    "@causal-order/transport/testing",
    "--pipeline",
    "@causal-order/testing/providers/default",
    "--dedupe-config",
    dedupeConfigPath,
    "--monitor",
    "--duration",
    duration,
    "--steady-for",
    steadyFor,
    "--time-scale",
    "60",
    "--report-every",
    duration,
    "--events-per-second",
    "2",
    "--chaos-multiplier",
    "1.2",
    "--max-tail-drain",
    "10m",
    "--profile-file",
    qualificationProfilePath,
    "--monitor-scenario",
    id,
    "--run-name",
    runName,
    "--output",
    summaryPath,
  ]
  const result = run(process.execPath, args, consumerRoot, expectSuccess)
  return { result, summaryPath }
}

function assertScenarioContract(summary, scenario) {
  assert.equal(summary.outcome.status, "completed")
  assert.equal(summary.outcome.verdict, scenario.verdict)
  assert.ok(Number(summary.stream.orderedEvents) > 0)
  assert.equal(Number(summary.transport.receivedEvents), Number(summary.simulation.sent))
  assert.ok(Number(summary.dedupeDecisions.byReason.accepted ?? 0) > 0)
  assert.ok(Number(summary.dedupeDecisions.byIdentitySource.id ?? 0) > 0)
  assert.equal(Number(summary.dedupeDecisions.byReason.legacy_boolean_result ?? 0), 0)
  assert.ok(Number(summary.monitor.normalDeliveriesToDedupe ?? 0) > 0)
  assert.equal(Number(summary.monitor.pendingRows), 0)
  assert.equal(Number(summary.monitor.operationTracker.pendingOperations), 0)
  assert.equal(Number(summary.monitor.lifecycleSnapshot.queueDepth), 0)
  assert.equal(summary.monitor.lifecycleFlush.status, "drained")

  const analysis = summary.monitor.analysis
  assert.equal(analysis.endedDrained, true)
  if (scenario.id === "monitor-order-outage") {
    assert.equal(analysis.sawOrderBufferOnly, true)
    assert.equal(analysis.sawReplayThroughDedupe, true)
  }
  if (scenario.id === "monitor-dual-outage") {
    assert.equal(analysis.sawFullOutageBuffer, true)
    assert.equal(analysis.sawReplayThroughDedupe, true)
  }
  if (scenario.id === "monitor-dedupe-outage") {
    assert.equal(analysis.sawDedupeBypass, true)
  } else {
    assert.equal(Number(summary.stream.orderedEvents), Number(summary.simulation.generated))
    assert.equal(
      Number(summary.dedupeDecisions.byReason.accepted ?? 0) +
        Number(summary.dedupeDecisions.byReason.duplicate ?? 0),
      Number(summary.transport.receivedEvents),
    )
    assert.equal(analysis.sawDedupeBypass, false)
    assert.equal(Number(summary.stream.byAnomalyType.duplicate_event ?? 0), 0)
  }
  if (scenario.id === "monitor-replay-retry-backoff") {
    assert.equal(analysis.replayFailureInjected, true)
    assert.equal(analysis.sawReplayThroughDedupe, true)
  }
}

function summarizeScenario(summary) {
  return {
    scenarioId: summary.monitor.scenarioId,
    verdict: summary.outcome.verdict,
    generated: summary.simulation.generated,
    ordered: summary.stream.orderedEvents,
    duplicateAnomalies: summary.stream.byAnomalyType.duplicate_event ?? 0,
    dedupeDecisions: summary.dedupeDecisions,
    monitorAnalysis: summary.monitor.analysis,
    wallElapsedMs: summary.timing.wallElapsedMs,
  }
}

function runNpm(args, cwd) {
  const npmCli = process.env.npm_execpath || path.join(
    path.dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npm-cli.js",
  )
  return run(process.execPath, [npmCli, ...args], cwd)
}

function parseJsonArray(output, label) {
  const start = output.search(/\[\s*\{/)
  if (start === -1) {
    throw new Error(`${label} did not emit a JSON array\n${output}`)
  }
  return JSON.parse(output.slice(start))
}

function run(command, args, cwd, expectSuccess = true) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: false,
    env: { ...process.env, npm_config_cache: cacheRoot },
  })
  const succeeded = result.status === 0
  if (expectSuccess !== succeeded) {
    throw new Error(
      `${command} ${args.join(" ")} returned ${String(result.status)}${result.error ? ` (${String(result.error)})` : ""}\nstdout:\n${result.stdout ?? ""}\nstderr:\n${result.stderr ?? ""}`,
    )
  }
  return result
}
