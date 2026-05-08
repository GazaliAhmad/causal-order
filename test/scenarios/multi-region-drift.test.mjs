import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { multiRegionDriftFixture } from "../fixtures/multi-region-drift.mjs"
import { test } from "../helpers/harness.mjs"

test("multi-region drift fixture keeps independent cross-node events as unknown rather than concurrent", () => {
  const fixture = multiRegionDriftFixture()
  const result = orderEvents(fixture.events)

  assert.ok(result.ordered.every((entry) => entry.confidence === "derived"))
})
