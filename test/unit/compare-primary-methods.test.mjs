import assert from "node:assert/strict"

import {
  compareByHlc,
  compareDeterministically,
} from "../../dist/index.js"
import { makeEvent } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("compareByHlc is the primary direct HLC comparison helper", () => {
  const a = {
    physicalTimeMs: 1_000n,
    logicalCounter: 0,
    nodeId: "node-a",
  }
  const b = {
    physicalTimeMs: 1_000n,
    logicalCounter: 1,
    nodeId: "node-b",
  }

  assert.equal(compareByHlc(a, b), "before")
  assert.equal(compareByHlc(b, a), "after")
})

test("compareDeterministically provides explicit deterministic fallback ordering", () => {
  const eventA = makeEvent({
    id: "evt-a",
    nodeId: "node-a",
    physicalTimeMs: 5_000n,
    ingestedAt: 20n,
  })
  const eventB = makeEvent({
    id: "evt-b",
    nodeId: "node-b",
    physicalTimeMs: 5_000n,
    ingestedAt: 10n,
  })

  assert.equal(
    compareDeterministically(eventA, eventB, "ingestion_order"),
    1,
  )
  assert.equal(
    compareDeterministically(eventB, eventA, "ingestion_order"),
    -1,
  )
})
