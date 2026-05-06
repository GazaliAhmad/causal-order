import assert from "node:assert/strict"

import {
  createHlcClock,
  parseHlc,
  serializeHlc,
} from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"

test("serializeHlc and parseHlc round-trip", () => {
  const clock = {
    physicalTimeMs: 1714971840123n,
    logicalCounter: 4,
    nodeId: "api-1",
  }

  const serialized = serializeHlc(clock)
  assert.equal(serialized, "1714971840123:4:api-1")
  assert.deepEqual(parseHlc(serialized), clock)
})

test("parseHlc throws on malformed input", () => {
  assert.throws(() => parseHlc("bad-value"), /Invalid HLC string/)
})

test("createHlcClock stays monotonic when wall clock does not move forward", () => {
  let current = 10_000n
  const clock = createHlcClock({
    nodeId: "node-a",
    now: () => current,
  })

  const first = clock.now()
  const second = clock.now()
  current = 9_000n
  const third = clock.now()

  assert.deepEqual(first, {
    physicalTimeMs: 10_000n,
    logicalCounter: 1,
    nodeId: "node-a",
  })
  assert.deepEqual(second, {
    physicalTimeMs: 10_000n,
    logicalCounter: 2,
    nodeId: "node-a",
  })
  assert.deepEqual(third, {
    physicalTimeMs: 10_000n,
    logicalCounter: 3,
    nodeId: "node-a",
  })
})

test("createHlcClock.receive merges remote clocks and advances logical time", () => {
  const clock = createHlcClock({
    nodeId: "node-a",
    now: () => 10_000n,
  })

  const merged = clock.receive({
    physicalTimeMs: 10_005n,
    logicalCounter: 7,
    nodeId: "node-b",
  })

  assert.deepEqual(merged, {
    physicalTimeMs: 10_005n,
    logicalCounter: 8,
    nodeId: "node-a",
  })
})
