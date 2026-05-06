import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { multiRegionDriftFixture } from "../fixtures/multi-region-drift.mjs"
import { test } from "../helpers/harness.mjs"

test("multi-region drift fixture groups independent cross-node events as concurrent", () => {
  const fixture = multiRegionDriftFixture()
  const result = orderEvents(fixture.events)

  assert.equal(result.concurrentGroups.length, 1)
  assert.equal(result.concurrentGroups[0].length, 3)
  assert.ok(result.ordered.every((entry) => entry.confidence === "derived"))
})
