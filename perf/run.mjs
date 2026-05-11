import {
  getProfile,
  listProfileNames,
  printBenchmarkSummary,
  runBenchmarkCaseAsync,
  runBenchmarkCase,
  toCsv,
  writeCsvFile,
} from "./benchmark-lib.mjs"

function parseArgs(argv) {
  const args = [...argv]
  const options = {
    all: false,
    list: false,
    csv: false,
    out: undefined,
    profiles: [],
  }

  while (args.length > 0) {
    const current = args.shift()

    if (current === "--all") {
      options.all = true
      continue
    }

    if (current === "--list") {
      options.list = true
      continue
    }

    if (current === "--csv") {
      options.csv = true
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

    if (current === "--out") {
      const out = args.shift()
      if (out === undefined) {
        throw new Error("Missing path after --out")
      }
      options.out = out
      continue
    }

    throw new Error(`Unknown argument: ${current}`)
  }

  return options
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

  const profileNames = options.all
    ? listProfileNames()
    : options.profiles.length > 0
      ? options.profiles
      : ["baseline-100k-shuffled"]

  const runs = []
  for (const name of profileNames) {
    const profile = getProfile(name)
    const run = profile.mode === "stream"
      ? await runBenchmarkCaseAsync(profile)
      : runBenchmarkCase(profile)
    runs.push(run)
  }

  if (!options.csv) {
    for (const run of runs) {
      printBenchmarkSummary(run)
    }
  }

  const csv = toCsv(runs)
  if (options.csv) {
    console.log(csv)
  }

  if (options.out !== undefined) {
    await writeCsvFile(options.out, runs)
    if (!options.csv) {
      console.log(`\nWrote CSV report to ${options.out}`)
    }
  }
}

await main()
