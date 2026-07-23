import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

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

function assertWebsiteGuidesDoNotLinkRepoOnlyGuides(websiteGuides) {
  const repoOnlyGuideLinkPatterns = [
    /https:\/\/github\.com\/GazaliAhmad\/causal-order\/blob\/main\/guides\/stability\//,
    /https:\/\/github\.com\/GazaliAhmad\/causal-order\/blob\/main\/guides\/devex\//,
    /https:\/\/github\.com\/GazaliAhmad\/causal-order\/blob\/main\/guides\/operations\/implementation-guide-/,
  ]

  for (const doc of websiteGuides) {
    const html = doc.html ?? ""
    for (const pattern of repoOnlyGuideLinkPatterns) {
      assert.equal(
        pattern.test(html),
        false,
        `website guide ${doc.relativePath} should not link to repo-only guide material matching ${pattern}`,
      )
    }
  }
}

async function main() {
  const websiteDocs = await import(
    pathToFileURL(path.join(rootDir, "website/src/lib/docs.js")).href
  )
  const readme = await readRootFile("README.md")
  const roadmap = await readRootFile("ROADMAP.md")
  const packageManifest = JSON.parse(await readRootFile("package.json"))
  const websiteManifest = JSON.parse(await readRootFile("website/package.json"))
  const compatibility = await readRootFile("COMPATIBILITY.md")
  const ciWorkflow = await readRootFile(".github/workflows/ci.yml")
  const postMerge150kWorkflow = await readRootFile(".github/workflows/post-merge-150k.yml")
  const postMerge250kWorkflow = await readRootFile(".github/workflows/post-merge-250k.yml")
  const publishWorkflow = await readRootFile(".github/workflows/publish.yml")
  assertIncludes(readme, "@causal-order/transport -> [@causal-order/monitor] -> @causal-order/dedupe -> causal-order", "README")
  assertIncludes(readme, "qualification infrastructure, not a fifth runtime stage", "README")
  assertIncludes(readme, "`@causal-order/testing`", "README")
  assertIncludes(readme, "Node.js `>=22.13.0`", "README")
  assertIncludes(readme, "validated on Node.js `22` and `24`", "README")
  assertIncludes(readme, "Published package version: `v1.0.1`", "README")
  assertIncludes(readme, "docs/releases/1.0.1.md", "README")
  assertIncludes(roadmap, "Published package version: `v1.0.1`", "ROADMAP.md")
  assertIncludes(roadmap, "preserved it through `1.0.1`", "ROADMAP.md")
  assert.equal(packageManifest.engines?.node, ">=22.13.0", "package Node.js floor should match the stack")
  assert.equal(websiteManifest.engines?.node, ">=22.13.0", "website Node.js floor should match the stack")
  assertIncludes(compatibility, "Node.js `>=22.13.0`", "COMPATIBILITY.md")
  assertIncludes(compatibility, "supported CI lines: Node.js `22` and `24`", "COMPATIBILITY.md")
  for (const [label, workflow] of [
    ["CI", ciWorkflow],
    ["post-merge 150k", postMerge150kWorkflow],
    ["post-merge 250k", postMerge250kWorkflow],
  ]) {
    assertIncludes(workflow, "          - 22", `${label} workflow`)
    assertIncludes(workflow, "          - 24", `${label} workflow`)
    assert.equal(workflow.includes("          - 18"), false, `${label} workflow should not test Node.js 18`)
    assert.equal(workflow.includes("          - 20"), false, `${label} workflow should not test Node.js 20`)
  }
  assertIncludes(publishWorkflow, "node-version: 24", "publish workflow")
  assertIncludes(publishWorkflow, "npm run release:check", "publish workflow")
  assertIncludes(publishWorkflow, "npm run release:stack:check", "publish workflow")
  assert.ok(
    publishWorkflow.indexOf("npm run release:stack:check") < publishWorkflow.indexOf("npm publish --provenance"),
    "publish workflow should verify the exact stack before npm publication",
  )
  const examplesReadme = await readRootFile("examples/README.md")
  const guidesReadme = await readRootFile("guides/README.md")
  const packageSurfaceOverview = await readRootFile("guides/package-surface-overview.md")
  const websiteHome = await readRootFile("website/src/pages/index.astro")
  const quickStart = await readRootFile("guides/quick-start-scenarios.md")
  const extensionBoundaryGuide = await readRootFile("guides/extension-boundary-guide.md")
  const policyGuidance = await readRootFile("guides/policy-guidance.md")
  const wikiHome = await readRootFile("wiki/Home.md")
  const releaseNotes = await readRootFile("docs/releases/0.5.0.md")
  const releaseNotes060 = await readRootFile("docs/releases/0.6.0.md")
  const releaseNotes101 = await readRootFile("docs/releases/1.0.1.md")
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
  const incidentReviewGuide = await readRootFile("guides/operations/incident-review-guide.md")
  const anomalyInterpretationGuide = await readRootFile("guides/operations/anomaly-interpretation-guide.md")
  const operatorMetricsGuide = await readRootFile("guides/operations/operator-metrics-guide.md")
  const websiteGuides = websiteDocs.getDocsByCollection("guides")
  const websiteGuidePaths = new Set(websiteGuides.map((doc) => doc.relativePath))

  assertIncludes(readme, "https://causal-order.gazali.one/guides/quick-start-scenarios/", "README")
  assertIncludes(readme, "https://causal-order.gazali.one/guides/extension-boundary-guide/", "README")
  assertIncludes(readme, "https://causal-order.gazali.one/guides/policy-guidance/", "README")
  assertIncludes(readme, "https://causal-order.gazali.one/guides/operations/replay-inspection-workflow/", "README")
  assertIncludes(readme, "https://causal-order.gazali.one/guides/operations/streaming-reconciliation-workflow/", "README")
  assertIncludes(readme, "inspectOrderResult", "README")
  assertIncludes(readme, "summarizeTranslationAnomalies", "README")
  assertIncludes(readme, "`allowUnknownOrder`", "README")
  assertIncludes(readme, "it does not invent stronger certainty", "README")
  assertIncludes(readme, "Detailed concepts, operational workflows, case studies, and release history stay in", "README")

  assertIncludes(examplesReadme, "node examples/ingress-minimal.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "node examples/ingress-replay-pipeline.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "node examples/local-durable-buffer-replay.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "translateBatch()` to `orderEvents()` path", "examples/README.md")
  assertIncludes(examplesReadme, "inspectOrderResult()", "examples/README.md")
  assertIncludes(examplesReadme, "compareByHlc, compareDeterministically", "examples/README.md")

  assertIncludes(guidesReadme, "./quick-start-scenarios.md", "guides/README.md")
  assertIncludes(guidesReadme, "./extension-boundary-guide.md", "guides/README.md")
  assertIncludes(guidesReadme, "./policy-guidance.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.7.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.8.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.9.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/1.0.1.md", "guides/README.md")
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
  assertIncludes(guidesReadme, "./operations/incident-review-guide.md", "guides/README.md")
  assertIncludes(guidesReadme, "./operations/anomaly-interpretation-guide.md", "guides/README.md")
  assertIncludes(guidesReadme, "./operations/operator-metrics-guide.md", "guides/README.md")
  assertIncludes(guidesReadme, "These guides are the practical path for evaluating, adopting, and operating `causal-order`.", "guides/README.md")
  assertIncludes(guidesReadme, "For function-by-function reference, see the API docs.", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/ingress-minimal.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/ingress-replay-pipeline.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/local-durable-buffer-replay.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/false-audit-timeline.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/offline-sync-anomalies.mjs", "guides/README.md")

  assertIncludes(packageSurfaceOverview, "@causal-order/transport -> [@causal-order/monitor] -> @causal-order/dedupe -> causal-order", "guides/package-surface-overview.md")
  assertIncludes(packageSurfaceOverview, "`@causal-order/testing`", "guides/package-surface-overview.md")
  assertIncludes(packageSurfaceOverview, "it is not a delivery stage", "guides/package-surface-overview.md")
  assertIncludes(websiteHome, "www.npmjs.com/package/@causal-order/transport", "website homepage")
  assertIncludes(websiteHome, "www.npmjs.com/package/@causal-order/monitor", "website homepage")
  assertIncludes(websiteHome, "www.npmjs.com/package/@causal-order/dedupe", "website homepage")
  assertIncludes(websiteHome, "www.npmjs.com/package/@causal-order/testing", "website homepage")
  assertIncludes(websiteHome, 'version: "0.2.0"', "website homepage")
  assertIncludes(websiteHome, 'version: "0.6.0"', "website homepage")
  assertIncludes(websiteHome, 'version: "1.2.0"', "website homepage")
  assertIncludes(websiteHome, 'version: "1.0.1"', "website homepage")
  assertIncludes(websiteHome, "@causal-order/testing v0.3.1", "website homepage")
  assertIncludes(websiteHome, "Node.js ≥22.13.0", "website homepage")
  assertIncludes(websiteHome, "Testing surrounds the stack; it is not another delivery stage.", "website homepage")
  assertIncludes(websiteHome, "One owner for each operational responsibility.", "website homepage")

  assertIncludes(quickStart, "node examples/false-audit-timeline.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/ingress-replay-pipeline.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/local-durable-buffer-replay.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/multi-region-drift.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/offline-sync-anomalies.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "./policy-guidance.md", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "./operations/replay-inspection-workflow.md", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "./operations/streaming-reconciliation-workflow.md", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "/api/", "guides/quick-start-scenarios.md")

  assertIncludes(extensionBoundaryGuide, "translateBatch()", "guides/extension-boundary-guide.md")
  assertIncludes(extensionBoundaryGuide, "CausalContradictionPolicy", "guides/extension-boundary-guide.md")
  assertIncludes(extensionBoundaryGuide, "./examples-and-entrypoints.md", "guides/extension-boundary-guide.md")
  assertIncludes(extensionBoundaryGuide, "./operations/incident-review-guide.md", "guides/extension-boundary-guide.md")

  assertIncludes(policyGuidance, "### `flag`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `drop`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `emit_correction`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `fail`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "`strict: true`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "`strict: false`", "guides/policy-guidance.md")

  assertIncludes(wikiHome, "[guides](/guides/)", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/quick-start-scenarios/", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/policy-guidance/", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/operations/replay-inspection-workflow/", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/operations/streaming-reconciliation-workflow/", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/operations/operator-metrics-guide/", "wiki/Home.md")
  assertIncludes(wikiHome, "README", "wiki/Home.md")
  assertIncludes(wikiHome, "How To Use These Docs", "wiki/Home.md")

  assertIncludes(releaseNotes, "compatibility helper aliases", "docs/releases/0.5.0.md")
  assertIncludes(releaseNotes, "guides/stability/implementation-guide-0.5.0.md", "docs/releases/0.5.0.md")
  assertIncludes(releaseNotes, "next published release line is now `0.6.0`", "docs/releases/0.5.0.md")
  assertIncludes(releaseNotes060, "operational-tooling and integrations follow-through release", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes060, "causal-order/inspect", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes060, "local durable-buffer replay", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes060, "guides/operations/operator-metrics-guide.md", "docs/releases/0.6.0.md")
  assertIncludes(releaseNotes101, "@causal-order/transport` | `0.2.0`", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "@causal-order/monitor` | `0.6.0`", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "@causal-order/dedupe` | `1.2.0`", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "@causal-order/testing` | `0.3.1`", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "Published package version: `v1.0.1`", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "negative control that must return `fail_contract`", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "does not change runtime source", "docs/releases/1.0.1.md")
  assertIncludes(releaseNotes101, "Node.js `18` and `20` are not supported by `v1.0.1`", "docs/releases/1.0.1.md")

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
  assertIncludes(incidentReviewGuide, "inspectOrderResult()", "guides/operations/incident-review-guide.md")
  assertIncludes(incidentReviewGuide, "inspectOrderBatch()", "guides/operations/incident-review-guide.md")
  assertIncludes(incidentReviewGuide, "./anomaly-interpretation-guide.md", "guides/operations/incident-review-guide.md")
  assertIncludes(incidentReviewGuide, "../aws-inspired-dynamodb-outage.md", "guides/operations/incident-review-guide.md")
  assertIncludes(anomalyInterpretationGuide, "`duplicate_event`", "guides/operations/anomaly-interpretation-guide.md")
  assertIncludes(anomalyInterpretationGuide, "`late_arrival`", "guides/operations/anomaly-interpretation-guide.md")
  assertIncludes(anomalyInterpretationGuide, "`missing_required_value`", "guides/operations/anomaly-interpretation-guide.md")
  assertIncludes(anomalyInterpretationGuide, "./replay-inspection-workflow.md", "guides/operations/anomaly-interpretation-guide.md")
  assertIncludes(anomalyInterpretationGuide, "../hardening/anomaly-surface-0.3.2.md", "guides/operations/anomaly-interpretation-guide.md")
  assertIncludes(operatorMetricsGuide, "watermark progress", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "late-arrival frequency", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "anomaly-rate monitoring", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "correction-rate monitoring", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "inspectOrderBatch()", "guides/operations/operator-metrics-guide.md")
  assertIncludes(operatorMetricsGuide, "inspectOrderResult()", "guides/operations/operator-metrics-guide.md")
  assert.equal(websiteGuidePaths.has("operations/implementation-guide-0.6.0.md"), false, "website guides should exclude implementation guides")
  assert.equal(websiteGuidePaths.has("stability/implementation-guide-0.5.0.md"), false, "website guides should exclude stability implementation notes")
  assert.equal(websiteGuidePaths.has("stability/0.9.0-checklist.md"), false, "website guides should exclude repo-local 0.9.0 checklist notes")
  assert.equal(websiteGuidePaths.has("stability/0.9.0-a-status-pass.md"), false, "website guides should exclude repo-local 0.9.0-a status-pass notes")
  assert.equal(websiteGuidePaths.has("stability/0.9.0-b-status-pass.md"), false, "website guides should exclude repo-local 0.9.0-b status-pass notes")
  assert.equal(websiteGuidePaths.has("stability/0.9.0-c-status-pass.md"), false, "website guides should exclude repo-local 0.9.0-c status-pass notes")
  assert.equal(websiteGuidePaths.has("stability/decision-record-api-clarity-0.5.0.md"), false, "website guides should exclude decision records")
  assert.equal(websiteGuidePaths.has("stability/domain-semantic-design-notes-0.5.0.md"), false, "website guides should exclude design notes")
  assert.equal(websiteGuidePaths.has("devex/developer-experience-0.4.0.md"), false, "website guides should exclude developer-experience notes")
  assertWebsiteGuidesDoNotLinkRepoOnlyGuides(websiteGuides)

  await assertExampleImportsStayPackageFacing()

  console.log("PASS docs and examples stay synchronized around the current package-facing evaluation path")
}

await main()
