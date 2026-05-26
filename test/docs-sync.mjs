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
  const releaseNotes = await readRootFile("docs/releases/0.4.2.md")
  const stabilityGuide = await readRootFile("guides/stability/implementation-guide-0.5.0.md")
  const surfaceInventory = await readRootFile("guides/stability/exported-surface-inventory-0.5.0.md")

  assertIncludes(readme, "guides/quick-start-scenarios.md", "README")
  assertIncludes(readme, "guides/policy-guidance.md", "README")
  assertIncludes(readme, "docs/releases/0.4.2.md", "README")
  assertIncludes(readme, "guides/stability/implementation-guide-0.5.0.md", "README")
  assertIncludes(readme, "examples/ingress-minimal.mjs", "README")
  assertIncludes(readme, "examples/ingress-replay-pipeline.mjs", "README")
  assertIncludes(readme, "examples/false-audit-timeline.mjs", "README")
  assertIncludes(readme, "examples/offline-sync-anomalies.mjs", "README")
  assertIncludes(readme, "package consumer point of view", "README")

  assertIncludes(examplesReadme, "node examples/ingress-minimal.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "node examples/ingress-replay-pipeline.mjs", "examples/README.md")
  assertIncludes(examplesReadme, "translateBatch()` to `orderEvents()` path", "examples/README.md")

  assertIncludes(guidesReadme, "./quick-start-scenarios.md", "guides/README.md")
  assertIncludes(guidesReadme, "./policy-guidance.md", "guides/README.md")
  assertIncludes(guidesReadme, "../docs/releases/0.4.2.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/implementation-guide-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "./stability/exported-surface-inventory-0.5.0.md", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/ingress-minimal.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/ingress-replay-pipeline.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/false-audit-timeline.mjs", "guides/README.md")
  assertIncludes(guidesReadme, "../examples/offline-sync-anomalies.mjs", "guides/README.md")

  assertIncludes(quickStart, "node examples/false-audit-timeline.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/ingress-replay-pipeline.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/multi-region-drift.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "node examples/offline-sync-anomalies.mjs", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "./policy-guidance.md", "guides/quick-start-scenarios.md")
  assertIncludes(quickStart, "../docs/releases/0.4.2.md", "guides/quick-start-scenarios.md")

  assertIncludes(policyGuidance, "### `flag`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `drop`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `emit_correction`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "### `fail`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "`strict: true`", "guides/policy-guidance.md")
  assertIncludes(policyGuidance, "`strict: false`", "guides/policy-guidance.md")

  assertIncludes(wikiHome, "/guides/quick-start-scenarios.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/policy-guidance.md", "wiki/Home.md")
  assertIncludes(wikiHome, "/guides/stability/implementation-guide-0.5.0.md", "wiki/Home.md")

  assertIncludes(releaseNotes, "examples/ingress-minimal.mjs", "docs/releases/0.4.2.md")
  assertIncludes(releaseNotes, "guides/policy-guidance.md", "docs/releases/0.4.2.md")
  assertIncludes(releaseNotes, "docs synchronization enforcement", "docs/releases/0.4.2.md")

  assertIncludes(stabilityGuide, "published package remains `0.4.2`", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "contradictory events, entity forks, and semantic dedupe across different IDs", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(stabilityGuide, "./exported-surface-inventory-0.5.0.md", "guides/stability/implementation-guide-0.5.0.md")
  assertIncludes(surfaceInventory, "`compareByHlc` versus `compareClocks`", "guides/stability/exported-surface-inventory-0.5.0.md")
  assertIncludes(surfaceInventory, "`orderValidatedEvents()` keeps a public `internal` parameter", "guides/stability/exported-surface-inventory-0.5.0.md")

  await assertExampleImportsStayPackageFacing()

  console.log("PASS docs and examples stay synchronized around the current package-facing evaluation path")
}

await main()
