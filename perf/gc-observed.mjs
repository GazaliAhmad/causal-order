import { spawn } from "node:child_process"

function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`)
  }

  return parsed
}

function parseNonNegativeInteger(value, label) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative integer`)
  }

  return parsed
}

function parseArgs(argv) {
  const args = [...argv]
  const options = {
    heapMb: 256,
    profiles: [],
    repeat: undefined,
    durationMs: undefined,
    pauseMs: undefined,
    warmup: undefined,
    list: false,
    forceGcBeforeCycle: true,
    forceGcAfterCycle: true,
  }

  while (args.length > 0) {
    const current = args.shift()

    if (current === "--list") {
      options.list = true
      continue
    }

    if (current === "--heap-mb") {
      const heapMb = args.shift()
      if (heapMb === undefined) {
        throw new Error("Missing value after --heap-mb")
      }
      options.heapMb = parsePositiveInteger(heapMb, "--heap-mb")
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
      options.repeat = parsePositiveInteger(repeat, "--repeat")
      continue
    }

    if (current === "--duration-ms") {
      const durationMs = args.shift()
      if (durationMs === undefined) {
        throw new Error("Missing value after --duration-ms")
      }
      options.durationMs = parsePositiveInteger(durationMs, "--duration-ms")
      continue
    }

    if (current === "--pause-ms") {
      const pauseMs = args.shift()
      if (pauseMs === undefined) {
        throw new Error("Missing value after --pause-ms")
      }
      options.pauseMs = parseNonNegativeInteger(pauseMs, "--pause-ms")
      continue
    }

    if (current === "--warmup") {
      const warmup = args.shift()
      if (warmup === undefined) {
        throw new Error("Missing value after --warmup")
      }
      options.warmup = parseNonNegativeInteger(warmup, "--warmup")
      continue
    }

    if (current === "--no-force-gc-before-cycle") {
      options.forceGcBeforeCycle = false
      continue
    }

    if (current === "--no-force-gc-after-cycle") {
      options.forceGcAfterCycle = false
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return options
}

function buildEnduranceArgs(options) {
  const args = ["perf/endurance.mjs"]

  if (options.list) {
    args.push("--list")
    return args
  }

  const profiles = options.profiles.length > 0
    ? options.profiles
    : ["streaming-150k-watermark-lag"]

  for (const profile of profiles) {
    args.push("--profile", profile)
  }

  if (options.repeat !== undefined) {
    args.push("--repeat", String(options.repeat))
  }

  if (options.durationMs !== undefined) {
    args.push("--duration-ms", String(options.durationMs))
  }

  if (options.pauseMs !== undefined) {
    args.push("--pause-ms", String(options.pauseMs))
  }

  if (options.warmup !== undefined) {
    args.push("--warmup", String(options.warmup))
  }

  if (options.forceGcBeforeCycle) {
    args.push("--force-gc-before-cycle")
  }

  if (options.forceGcAfterCycle) {
    args.push("--force-gc-after-cycle")
  }

  return args
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const enduranceArgs = buildEnduranceArgs(options)

  if (!options.list) {
    console.log(
      `Running GC-observed endurance harness with --max-old-space-size=${options.heapMb} and --expose-gc`,
    )
  }

  await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [`--max-old-space-size=${options.heapMb}`, "--expose-gc", ...enduranceArgs],
      {
        cwd: process.cwd(),
        stdio: "inherit",
      },
    )

    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise()
      } else {
        rejectPromise(new Error(`GC-observed endurance run failed with exit code ${code}`))
      }
    })
    child.on("error", rejectPromise)
  })
}

await main()
