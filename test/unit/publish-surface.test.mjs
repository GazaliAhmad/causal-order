import assert from "node:assert/strict"

import * as causalOrder from "../../dist/index.js"
import { test } from "../helpers/harness.mjs"

test("built package exposes the documented top-level runtime API", () => {
  const expectedExports = [
    "compareByCausality",
    "compareByHlc",
    "compareDeterministically",
    "createProcessingTimeWatermark",
    "createHlcClock",
    "detectAnomalies",
    "eventTimeWatermark",
    "ingestedAtWatermark",
    "orderEvents",
    "orderEventStream",
    "parseHlc",
    "serializeHlc",
    "validateClock",
    "validateEvent",
  ]

  for (const exportName of expectedExports) {
    assert.equal(typeof causalOrder[exportName], "function")
  }
})
