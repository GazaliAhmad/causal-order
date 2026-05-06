import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { replayCorruptionFixture } from "../fixtures/replay-corruption.mjs"
import { test } from "../helpers/harness.mjs"

test("replay corruption fixture surfaces duplicate anomalies without crashing analysis", () => {
  const fixture = replayCorruptionFixture()
  const result = orderEvents(fixture.events, {
    strict: false,
  })

  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"))
  assert.ok(result.ordered.some((entry) => entry.event.id === "payment-captured-1"))
})
