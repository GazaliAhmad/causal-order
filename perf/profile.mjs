import { mkdir, readFile } from "node:fs/promises"
import { basename, join, relative, resolve } from "node:path"
import { spawn } from "node:child_process"

const defaultProfileNames = [
  "stress-150k-inversion-chains",
  "stress-150k-replay-storms",
  "stress-150k-sequence-conflicts",
  "stress-150k-sparse-causality",
]

function parseArgs(argv) {
  const args = [...argv]
  const options = {
    list: false,
    outDir: "perf/results/cpu-profiles",
    profileNames: [],
    top: 12,
  }

  while (args.length > 0) {
    const current = args.shift()

    if (current === "--list") {
      options.list = true
      continue
    }

    if (current === "--profile") {
      const profileName = args.shift()
      if (profileName === undefined) {
        throw new Error("Missing profile name after --profile")
      }
      options.profileNames.push(profileName)
      continue
    }

    if (current === "--out-dir") {
      const outDir = args.shift()
      if (outDir === undefined) {
        throw new Error("Missing path after --out-dir")
      }
      options.outDir = outDir
      continue
    }

    if (current === "--top") {
      const top = Number.parseInt(args.shift() ?? "", 10)
      if (!Number.isFinite(top) || top <= 0) {
        throw new Error("Expected a positive integer after --top")
      }
      options.top = top
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return options
}

function formatMs(milliseconds) {
  return `${milliseconds.toFixed(2)} ms`
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`
}

function normalizeUrl(url) {
  if (url === undefined || url.length === 0) {
    return "<native>"
  }

  if (url.startsWith("file:///")) {
    const filePath = decodeURIComponent(url.slice("file:///".length)).replaceAll("/", "\\")
    const relativePath = relative(process.cwd(), filePath)
    return relativePath.length > 0 && !relativePath.startsWith("..") ? relativePath : filePath
  }

  if (url.startsWith("node:")) {
    return url
  }

  return basename(url)
}

function formatFrameKey(callFrame) {
  const functionName = callFrame.functionName?.length > 0 ? callFrame.functionName : "(anonymous)"
  const url = normalizeUrl(callFrame.url)
  const line = typeof callFrame.lineNumber === "number" && callFrame.lineNumber >= 0
    ? `:${callFrame.lineNumber + 1}`
    : ""

  return `${functionName} (${url}${line})`
}

function summarizeCpuProfile(profile, { top }) {
  const nodeById = new Map()
  const parentById = new Map()

  for (const node of profile.nodes ?? []) {
    nodeById.set(node.id, node)
    for (const childId of node.children ?? []) {
      parentById.set(childId, node.id)
    }
  }

  const samples = profile.samples ?? []
  const timeDeltas = profile.timeDeltas ?? []
  const selfByNodeId = new Map()
  const inclusiveByNodeId = new Map()
  let totalMicroseconds = 0

  for (let index = 0; index < samples.length; index += 1) {
    const nodeId = samples[index]
    const delta = timeDeltas[index] ?? 0
    totalMicroseconds += delta
    selfByNodeId.set(nodeId, (selfByNodeId.get(nodeId) ?? 0) + delta)

    let currentId = nodeId
    while (currentId !== undefined) {
      inclusiveByNodeId.set(currentId, (inclusiveByNodeId.get(currentId) ?? 0) + delta)
      currentId = parentById.get(currentId)
    }
  }

  const frameTotals = new Map()

  for (const [nodeId, node] of nodeById) {
    const key = formatFrameKey(node.callFrame ?? {})
    const current = frameTotals.get(key) ?? {
      key,
      selfMicroseconds: 0,
      inclusiveMicroseconds: 0,
    }
    current.selfMicroseconds += selfByNodeId.get(nodeId) ?? 0
    current.inclusiveMicroseconds += inclusiveByNodeId.get(nodeId) ?? 0
    frameTotals.set(key, current)
  }

  const rows = [...frameTotals.values()]
    .filter((row) => !row.key.startsWith("(root) ") && !row.key.startsWith("(program) "))
    .sort((a, b) => b.inclusiveMicroseconds - a.inclusiveMicroseconds)

  const topInclusive = rows.slice(0, top)
  const topSelf = [...rows]
    .sort((a, b) => b.selfMicroseconds - a.selfMicroseconds)
    .slice(0, top)

  return {
    totalMilliseconds: totalMicroseconds / 1000,
    topInclusive,
    topSelf,
  }
}

async function loadCpuProfile(profilePath) {
  const content = await readFile(profilePath, "utf8")
  return JSON.parse(content)
}

async function runCpuProfile(profileName, options) {
  const profileFilename = `${profileName}-${Date.now()}.cpuprofile`
  const profilePath = join(options.outDir, profileFilename)

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [
        "--cpu-prof",
        `--cpu-prof-dir=${resolve(options.outDir)}`,
        `--cpu-prof-name=${basename(profilePath)}`,
        "perf/run.mjs",
        "--profile",
        profileName,
      ],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      },
    )

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        rejectPromise(new Error(`CPU profile run failed for ${profileName} with exit code ${code}`))
      }
    })
    child.on("error", rejectPromise)
  })

  const summary = summarizeCpuProfile(await loadCpuProfile(profilePath), options)
  console.log(`\nCPU summary for ${profileName}`)
  console.log(`Captured samples: ${formatMs(summary.totalMilliseconds)}`)
  console.log("Top inclusive frames:")
  for (const row of summary.topInclusive) {
    const milliseconds = row.inclusiveMicroseconds / 1000
    const percent = summary.totalMilliseconds > 0
      ? (milliseconds / summary.totalMilliseconds) * 100
      : 0
    console.log(`- ${formatPercent(percent)} ${formatMs(milliseconds)} ${row.key}`)
  }
  console.log("Top self frames:")
  for (const row of summary.topSelf) {
    const milliseconds = row.selfMicroseconds / 1000
    const percent = summary.totalMilliseconds > 0
      ? (milliseconds / summary.totalMilliseconds) * 100
      : 0
    console.log(`- ${formatPercent(percent)} ${formatMs(milliseconds)} ${row.key}`)
  }
  console.log(`Saved CPU profile: ${profilePath}`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const profileNames = options.profileNames.length > 0
    ? options.profileNames
    : defaultProfileNames

  if (options.list) {
    for (const profileName of defaultProfileNames) {
      console.log(profileName)
    }
    return
  }

  await mkdir(options.outDir, { recursive: true })

  for (const profileName of profileNames) {
    await runCpuProfile(profileName, options)
  }
}

await main()
