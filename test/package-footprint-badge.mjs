import assert from "node:assert/strict"
import { readdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { brotliCompressSync, gzipSync } from "node:zlib"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, "..")
const badgeFile = path.join(rootDir, "website", "public", "package-footprint-badge.json")
const badgeSvgFile = path.join(rootDir, "website", "public", "package-footprint-badge.svg")
const reportFile = path.join(rootDir, "website", "public", "package-footprint.json")
const checkMode = process.argv.includes("--check")

async function readPackageJson() {
  const content = await readFile(path.join(rootDir, "package.json"), "utf8")
  return JSON.parse(content)
}

function isGlobPattern(value) {
  return /[*?[{\]!]/.test(value)
}

async function collectFiles(entryPath, output) {
  const fullPath = path.join(rootDir, entryPath)
  const fileStat = await stat(fullPath)

  if (fileStat.isDirectory()) {
    const children = await readdir(fullPath, { withFileTypes: true })

    for (const child of children.sort((left, right) => left.name.localeCompare(right.name))) {
      const relativeChild = path.posix.join(entryPath, child.name)

      if (child.isDirectory()) {
        await collectFiles(relativeChild, output)
      } else if (child.isFile()) {
        output.add(relativeChild)
      }
    }

    return
  }

  if (fileStat.isFile()) {
    output.add(entryPath)
  }
}

async function resolvePublishedFiles(packageJson) {
  const files = new Set(["package.json"])

  for (const entry of packageJson.files ?? []) {
    if (isGlobPattern(entry)) {
      throw new Error(
        `Unsupported package.files entry "${entry}". Update test/package-footprint-badge.mjs to handle globs before using this automation.`,
      )
    }

    await collectFiles(entry, files)
  }

  for (const maybeIncluded of ["README.md", "README", "LICENSE", "LICENCE"]) {
    try {
      const maybeStat = await stat(path.join(rootDir, maybeIncluded))
      if (maybeStat.isFile()) {
        files.add(maybeIncluded)
      }
    } catch {
      // npm auto-includes these files only when they exist.
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right))
}

function formatSize(bytes) {
  if (bytes < 1000) {
    return `${bytes} B`
  }

  return `${(bytes / 1000).toFixed(1)} kB`
}

async function summarizePublishedFiles(files) {
  const entries = []
  let rawBytes = 0
  let gzipBytes = 0
  let brotliBytes = 0

  for (const relativePath of files) {
    const absolutePath = path.join(rootDir, relativePath)
    const content = await readFile(absolutePath)
    const size = content.length
    const gzip = gzipSync(content).length
    const brotli = brotliCompressSync(content).length

    rawBytes += size
    gzipBytes += gzip
    brotliBytes += brotli

    entries.push({
      path: relativePath,
      size,
      gzip,
      brotli,
    })
  }

  return {
    entries,
    totals: {
      rawBytes,
      gzipBytes,
      brotliBytes,
      raw: formatSize(rawBytes),
      gzip: formatSize(gzipBytes),
      brotli: formatSize(brotliBytes),
    },
  }
}

function buildBadgePayload(summary) {
  return {
    schemaVersion: 1,
    label: "publish size",
    message: `${summary.totals.gzip} (gzip) | ${summary.totals.brotli} (brotli)`,
    color: "blue",
  }
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function estimateBadgeSegmentWidth(text) {
  return 10 + text.length * 7
}

function buildBadgeSvg(badge) {
  const leftWidth = estimateBadgeSegmentWidth(badge.label)
  const rightWidth = estimateBadgeSegmentWidth(badge.message)
  const totalWidth = leftWidth + rightWidth
  const height = 20
  const leftCenter = Math.round(leftWidth / 2)
  const rightCenter = leftWidth + Math.round(rightWidth / 2)
  const label = escapeXml(badge.label)
  const message = escapeXml(badge.message)

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${height}" role="img" aria-label="${label}: ${message}">`,
    `<title>${label}: ${message}</title>`,
    `<linearGradient id="badge-fill" x2="0" y2="100%">`,
    `<stop offset="0" stop-color="#ffffff" stop-opacity=".08"/>`,
    `<stop offset="1" stop-opacity=".08"/>`,
    `</linearGradient>`,
    `<clipPath id="badge-clip">`,
    `<rect width="${totalWidth}" height="${height}" rx="3" fill="#fff"/>`,
    `</clipPath>`,
    `<g clip-path="url(#badge-clip)">`,
    `<rect width="${leftWidth}" height="${height}" fill="#555"/>`,
    `<rect x="${leftWidth}" width="${rightWidth}" height="${height}" fill="#007ec6"/>`,
    `<rect width="${totalWidth}" height="${height}" fill="url(#badge-fill)"/>`,
    `</g>`,
    `<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">`,
    `<text x="${leftCenter}" y="15" fill="#010101" fill-opacity=".3">${label}</text>`,
    `<text x="${leftCenter}" y="14">${label}</text>`,
    `<text x="${rightCenter}" y="15" fill="#010101" fill-opacity=".3">${message}</text>`,
    `<text x="${rightCenter}" y="14">${message}</text>`,
    `</g>`,
    `</svg>`,
    "",
  ].join("\n")
}

function buildReportPayload(packageJson, files, summary, badge) {
  return {
    package: packageJson.name,
    version: packageJson.version,
    fileCount: files.length,
    totals: summary.totals,
    badge,
    files: summary.entries,
  }
}

async function syncFile(filePath, payload) {
  const nextContent = `${JSON.stringify(payload, null, 2)}\n`

  if (checkMode) {
    const currentContent = await readFile(filePath, "utf8")
    assert.equal(
      currentContent,
      nextContent,
      `${path.relative(rootDir, filePath)} is out of date. Run: npm run badge:footprint`,
    )
    return
  }

  await writeFile(filePath, nextContent, "utf8")
}

async function syncTextFile(filePath, content) {
  if (checkMode) {
    const currentContent = await readFile(filePath, "utf8")
    assert.equal(
      currentContent,
      content,
      `${path.relative(rootDir, filePath)} is out of date. Run: npm run badge:footprint`,
    )
    return
  }

  await writeFile(filePath, content, "utf8")
}

async function main() {
  const packageJson = await readPackageJson()
  const files = await resolvePublishedFiles(packageJson)
  const summary = await summarizePublishedFiles(files)
  const badge = buildBadgePayload(summary)
  const badgeSvg = buildBadgeSvg(badge)
  const report = buildReportPayload(packageJson, files, summary, badge)

  await syncFile(badgeFile, badge)
  await syncTextFile(badgeSvgFile, badgeSvg)
  await syncFile(reportFile, report)

  const prefix = checkMode ? "PASS" : "UPDATED"
  console.log(
    `${prefix} package footprint badge ${summary.totals.gzip} (gzip) | ${summary.totals.brotli} (brotli) across ${files.length} published files`,
  )
}

await main()
