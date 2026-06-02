import assert from "node:assert/strict"

import * as causalOrder from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"

test("built package exposes the documented top-level runtime API", () => {
  const expectedExports = [
    "applyTieBreaker",
    "compareByCausality",
    "compareByHlc",
    "compareDeterministically",
    "createProcessingTimeWatermark",
    "createHlcClock",
    "detectAnomalies",
    "explainOrderedEvent",
    "eventTimeWatermark",
    "inspectOrderBatch",
    "inspectOrderResult",
    "ingestedAtWatermark",
    "orderEvents",
    "orderEventStream",
    "parseHlc",
    "serializeHlc",
    "summarizeEventAnomalies",
    "summarizeTranslationAnomalies",
    "TranslateBatchPolicyError",
    "translateBatch",
    "validateClock",
    "validateEvent",
  ]

  for (const exportName of expectedExports) {
    assert.equal(typeof causalOrder[exportName], "function")
  }
})

test("built package keeps the final 0.9.x root compatibility and advanced helper posture", () => {
  assert.equal(typeof causalOrder.compareClocks, "function")
  assert.equal(typeof causalOrder.orderValidatedEvents, "function")
  assert.equal(typeof causalOrder.applyTieBreaker, "function")
  assert.equal(typeof causalOrder.compareDeterministically, "function")
  assert.equal("compareWithTieBreaker" in causalOrder, false)
})
