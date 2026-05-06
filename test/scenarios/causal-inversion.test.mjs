import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { causalInversionFixture } from "../fixtures/causal-inversion.mjs"
import { test } from "../helpers/harness.mjs"

test("causal inversion fixture flags explicit causality that conflicts with clock order", () => {
  const fixture = causalInversionFixture()
  const result = orderEvents(fixture.events)

  const ids = result.ordered.map((entry) => entry.event.id)
  assert.deepEqual(ids, ["request-received", "invoice-created"])
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "causal_inversion"))
})
