import assert from "node:assert/strict"

import {
  createHlcClock,
  parseHlc,
  serializeHlc,
} from "causal-order/clock"
import {
  compareByCausality,
  compareByHlc,
  compareDeterministically,
} from "causal-order/compare"
import {
  detectAnomalies,
} from "causal-order/anomalies"
import {
  orderEvents,
  orderEventStream,
  createProcessingTimeWatermark,
} from "causal-order/order"
import { translateBatch } from "causal-order/translate"
import { validateClock, validateEvent } from "causal-order/validate"
import { test } from "../helpers/harness.mjs"

test("package subpath exports expose focused runtime entrypoints", () => {
  const expectedFunctions = [
    createHlcClock,
    parseHlc,
    serializeHlc,
    compareByCausality,
    compareByHlc,
    compareDeterministically,
    detectAnomalies,
    orderEvents,
    orderEventStream,
    createProcessingTimeWatermark,
    translateBatch,
    validateClock,
    validateEvent,
  ]

  for (const exportedFunction of expectedFunctions) {
    assert.equal(typeof exportedFunction, "function")
  }
})
