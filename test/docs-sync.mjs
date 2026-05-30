import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const examplesDir = path.join(rootDir, "examples")

async function readRootFile(relativePath) {
  return readFile(path.join(rootDir, relativePath), "utf8")
}

async function listExampleModules() {
  const names = await readdir(examplesDir)

  return names
    .filter((name) => name.endsWith(".mjs"))
    .filter((name) => name !== "_shared.mjs" && name !== "benchmark.mjs" && name !== "smoke-demo.mjs")
}

function assertIncludes(content, expected, label) {
  assert.ok(
    content.includes(expected),
    `${label} is missing expected text: ${expected}`,
  )
}

async function assertExampleImportsStayPackageFacing() {
  const exampleModules = await listExampleModules()

  for (const name of exampleModules) {
    const content = await readFile(path.join(examplesDir, name), "utf8")
    assert.equal(
      content.includes("../dist/"),
      false,
      `example ${name} should not import from ../dist/`,
    )
  }
}

async function main() {
  const readme = await readRootFile("README.md")
  const examplesReadme = await readRootFile("examples/README.md")
  const guidesReadme = await readRootFile("guides/README.md")
  const quickStart = await readRootFile("guides/quick-start-scenarios.md")
  const policyGuidance = await readRootFile("guides/policy-guidance.md")
  const wikiHome = await readRootFile("wiki/Home.md")
  const releaseNotes = await readRootFile("docs/releases/0.5.0.md")
  const releaseNotes060 = await readRootFile("docs/releases/0.6.0.md")
  const stabilityGuide = await readRootFile("guides/stability/implementation-guide-0.5.0.md")
  const surfaceInventory = await readRootFile("guides/stability/exported-surface-inventory-0.5.0.md")
  const apiClarityRecord = await readRootFile("guides/stability/decision-record-api-clarity-0.5.0.md")
  const defaultInventory = await readRootFile("guides/stability/default-behavior-compatibility-inventory-0.5.0.md")
  const defaultBehaviorRecord = await readRootFile("guides/stability/decision-record-default-behavior-0.5.0.md")
  const domainDesignNotes = await readRootFile("guides/stability/domain-semantic-design-notes-0.5.0.md")
  const coreBoundaryRecord = await readRootFile("guides/stability/decision-record-core-boundaries-0.5.0.md")
  const migrationNotes = await readRootFile("guides/stability/migration-notes-0.5.0.md")
  const releasePrepNote = await readRootFile("guides/stability/release-prep-0.5.0.md")
  const replayInspectionWorkflow = await readRootFile("guides/operations/replay-inspection-workflow.md")
  const streamingReconciliationWorkflow = await readRootFile("guides/operations/streaming-reconciliation-workflow.md")
  const operatorMetricsGuide = await readRootFile("guides/operations/operator-metrics-guide.md")

  assertIncludes(readme, "guides/quick-start-scenarios.md", "README")
  assertIncludes(readme, "guides/policy-guidance.md", "README")
  assertIncludes(readme, "guides/operations/replay-inspection-workflow.md", "README")
  assertIncludes(readme, "guides/operations/streaming-reconciliation-workflow.md", "README")
  assertIncludes(readme, "guides/operations/operator-metrics-guide.md", "README")
  assertIncludes(readme, "docs/releases/0.6.0.md", "README")
  assertIncludes(readme, "docs/releases/0.5.0.md", "README")
  assertIncludes(readme, "guides/stability/implementation-guide-0.5.0.md", "README")
  assertIncludes(readme, "inspectOrderResult", "README")
  assertIncludes(readme, "summarizeTranslationAnomalies", "README")
  assertIncludes(readme, "compareByHlc, compareDeterministically", "README")
  assertIncludes(readme, "examples/ingress-minimal.mjs", "README")
  assertIncludes(readme, "examples/ingress-replay-pipeline.mjs", "README")
  assertIncludes(readme, "examples/local-durable-buffer-replay.mjs", "README")
  assertIncludes(readme, "examples/false-audit-timeline.mjs", "README")
  assertIncludes(readme, "examples/offline-sync-anomalies.mjs", "README")
  assertIncludes(readme, "package consumer point of view", "README")
  assertIncludes(readme, "Default Option Posture", "README")
  assertIncludes(readme, "`allowUnknownOrder`", "README")
  assertIncludes(readme, "does not invent stronger certainty", "README")
  assertIncludes(readme, "Translation Policy Surface", "README")
  assertIncludes(readme, "`optionalFieldFailure: \"warn\" | \"continue\" | \"fail\"`", "README")
  assertIncludes(readme, "TranslateBatchPolicyError", "README")

  assertIncludes(examplesReadme, "node examples/ingress-minimal.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "node examples/ingress-replay-pipeline.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "node examples/local-durable-buffer-replay.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "translateBatch()` to `orderEvents()` path", "examples/README.md")
  assertIncludes(examplesReadme, "inspectOrderResult()", "examples/README.md")
  assertIncludes(examplesReadme, "compareByHlc, compareDeterministically", "examples/README.md")

  assertIncludes(guidesReadme, "./quick-start-scenarios.md", "guides/README.md")
  assertIncludes(guidesReadme, "./policy-guidance.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.6.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/implementation-guide-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/exported-surface-inventory-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/decision-record-api-clarity-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/default-behavior-compatibility-inventory-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/decision-record-default-behavior-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/domain-semantic-design-notes-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/decision-record-core-boundaries-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/migration-notes-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/release-prep-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./operations/replay-inspection-workflow.md", "guides/README.md")
  assertIncludes(guidesReadme, "./operations/streaming-reconciliation-workflow.md", "guides/README.md")
  assertIncludes(guidesReadme, "./operations/operator-metrics-guide.md", "guides/README.md")
  assertIncludes(guidesReadme, "compareByHlc()` and `compareDeterministically()", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/ingress-minimal.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/ingress-replay-pipeline.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/local-durable-buffer-replay.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/false-audit-timeline.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/offline-sync-anomalies.mjs", "guides/README.md")

  assertIncludes(quickStart, "node examples/false-audit-timeline.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/ingress-replay-pipeline.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/local-durable-buffer-replay.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/multi-region-drift.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/offline-sync-anomalies.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "./policy-guidance.md", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "./operations/replay-inspection-workflow.md", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "../docs/releases/0.5.0.md", "guides/quick-start-scenarios.md")

  assertIncludes(policyGuidance, "### `flag`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `drop`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `emit_correction`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `fail`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "`strict: true`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "`strict: false`", "guides/policy-guidance.md")

  assertIncludes(wikiHome, "/guides/quick-start-scenarios.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/policy-guidance.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/operations/replay-inspection-workflow.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/operations/streaming-reconciliation-workflow.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/operations/operator-metrics-guide.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/stability/implementation-guide-0.5.0.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/docs/releases/0.6.0.md", "wiki/Home.md")

  assertIncludes(releaseNotes, "compatibility helper aliases", "docs/releases/0.5.0.md")
  assertIncludes(releaseNotes, "guides/stability/implementation-guide-0.5.0.md", "docs/releases/0.5.0.md")
  assertIncludes(releaseNotes, "next published release line is now `0.6.0`", "docs/releases/0.5.0.md")
  assertIncludes(releaseNotes060, "operational-tooling and integrations follow-through release", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes060, "causal-order/inspect", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes060, "local durable-buffer replay", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes060, "guides/operations/operator-metrics-guide.md", "docs/releases/0.6.0.md")

  assertIncludes(stabilityGuide, "published stability-and-contract-design release", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "contradictory events, entity forks, and semantic dedupe across different IDs", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./exported-surface-inventory-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./decision-record-api-clarity-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./default-behavior-compatibility-inventory-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./decision-record-default-behavior-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./domain-semantic-design-notes-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./decision-record-core-boundaries-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./migration-notes-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./release-prep-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "CausalContradictionPolicy", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "ForkResolutionPolicy", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "SemanticDedupePolicy", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(surfaceInventory, "`compareByHlc` versus `compareClocks`", "guides/stability/exported-surface-inventory-0.5.0.md")
  assertIncludes(surfaceInventory, "`orderValidatedEvents()` keeps a public `internal` parameter", "guides/stability/exported-surface-inventory-0.5.0.md")
  assertIncludes(surfaceInventory, "./decision-record-api-clarity-0.5.0.md", "guides/stability/exported-surface-inventory-0.5.0.md")
  assertIncludes(apiClarityRecord, "preserve `compareByHlc()` as the primary long-term public name", "guides/stability/decision-record-api-clarity-0.5.0.md")
  assertIncludes(apiClarityRecord, "preserve `compareDeterministically()` as the primary user-facing helper", "guides/stability/decision-record-api-clarity-0.5.0.md")
  assertIncludes(apiClarityRecord, "do not preserve the current `internal` parameter", "guides/stability/decision-record-api-clarity-0.5.0.md")
  assertIncludes(defaultInventory, "`orderEvents().strict` | `false`", "guides/stability/default-behavior-compatibility-inventory-0.5.0.md")
  assertIncludes(defaultInventory, "no contradiction, fork, or semantic-dedupe policy may silently erase operator visibility", "guides/stability/default-behavior-compatibility-inventory-0.5.0.md")
  assertIncludes(defaultBehaviorRecord, "preserve `strict: false` as the default", "guides/stability/decision-record-default-behavior-0.5.0.md")
  assertIncludes(defaultBehaviorRecord, "preserve `detectAnomalies: true` as the default", "guides/stability/decision-record-default-behavior-0.5.0.md")
  assertIncludes(defaultBehaviorRecord, "preserve `optionalFieldFailure: \"warn\"` as the default translation posture", "guides/stability/decision-record-default-behavior-0.5.0.md")
  assertIncludes(domainDesignNotes, "The core engine only detects and flags a contradiction", "guides/stability/domain-semantic-design-notes-0.5.0.md")
  assertIncludes(domainDesignNotes, "ContradictoryEventAnomaly", "guides/stability/domain-semantic-design-notes-0.5.0.md")
  assertIncludes(domainDesignNotes, "detect when a grouped identity stream splits concurrently", "guides/stability/domain-semantic-design-notes-0.5.0.md")
  assertIncludes(domainDesignNotes, "The engine must expose these duplicates inside the `OrderResult` and related telemetry rather than silently purging them", "guides/stability/domain-semantic-design-notes-0.5.0.md")
  assertIncludes(coreBoundaryRecord, "contradiction resolution belongs in `CausalContradictionPolicy`", "guides/stability/decision-record-core-boundaries-0.5.0.md")
  assertIncludes(coreBoundaryRecord, "branch selection belongs in `ForkResolutionPolicy`", "guides/stability/decision-record-core-boundaries-0.5.0.md")
  assertIncludes(coreBoundaryRecord, "belongs in `SemanticDedupePolicy`", "guides/stability/decision-record-core-boundaries-0.5.0.md")
  assertIncludes(coreBoundaryRecord, "core owns payload-agnostic detection", "guides/stability/decision-record-core-boundaries-0.5.0.md")
  assertIncludes(migrationNotes, "Prefer these names in new code", "guides/stability/migration-notes-0.5.0.md")
  assertIncludes(migrationNotes, "`compareClocks()` remains a compatibility alias for now", "guides/stability/migration-notes-0.5.0.md")
  assertIncludes(migrationNotes, "`strict: false` remains the default", "guides/stability/migration-notes-0.5.0.md")
  assertIncludes(migrationNotes, "Translation strictness is still configured separately", "guides/stability/migration-notes-0.5.0.md")
  assertIncludes(migrationNotes, "published npm line is now `0.5.0`", "guides/stability/migration-notes-0.5.0.md")
  assertIncludes(releasePrepNote, "all five original chunks", "guides/stability/release-prep-0.5.0.md")
  assertIncludes(releasePrepNote, "operator visibility as a hard compatibility direction", "guides/stability/release-prep-0.5.0.md")
  assertIncludes(releasePrepNote, "published stability-and-contract-design release", "guides/stability/release-prep-0.5.0.md")
  assertIncludes(releasePrepNote, "follow-through should be release discipline work, not a reopening of the `0.5.0` contract questions", "guides/stability/release-prep-0.5.0.md")
  assertIncludes(replayInspectionWorkflow, "inspectOrderResult()", "guides/operations/replay-inspection-workflow.md")
  assertIncludes(replayInspectionWorkflow, "explainOrderedEvent()", "guides/operations/replay-inspection-workflow.md")
  assertIncludes(replayInspectionWorkflow, "../after-hours-batch-processing.md", "guides/operations/replay-inspection-workflow.md")
  assertIncludes(streamingReconciliationWorkflow, "inspectOrderBatch()", "guides/operations/streaming-reconciliation-workflow.md")
  assertIncludes(streamingReconciliationWorkflow, "batch.correction", "guides/operations/streaming-reconciliation-workflow.md")
  assertIncludes(streamingReconciliationWorkflow, "../streaming-recovery-resync.md", "guides/operations/streaming-reconciliation-workflow.md")
  assertIncludes(operatorMetricsGuide, "watermark progress", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "late-arrival frequency", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "anomaly-rate monitoring", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "correction-rate monitoring", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "inspectOrderBatch()", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "inspectOrderResult()", "guides/operations/operator-metrics-guide.md")

  await assertExampleImportsStayPackageFacing()

  console.log("PASS docs and examples stay synchronized around the current package-facing evaluation path")
}

await main()
