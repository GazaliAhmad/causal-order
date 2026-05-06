export const tests = []

export function test(name, fn) {
  tests.push({ name, fn })
}

export async function run() {
  let failures = 0

  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`PASS ${name}`)
    } catch (error) {
      failures += 1
      console.error(`FAIL ${name}`)
      console.error(error)
    }
  }

  if (failures > 0) {
    process.exitCode = 1
  } else {
    console.log(`All ${tests.length} tests passed`)
  }
}
