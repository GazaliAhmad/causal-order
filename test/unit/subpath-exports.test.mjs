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
import {
  orderEvents as batchOrderEvents,
  compareWithTieBreaker,
  getTieBreaker,
} from "causal-order/batch"
import {
  orderEventStream as streamingOrderEventStream,
} from "causal-order/stream"
import {
  createProcessingTimeWatermark as createProcessingTimeWatermarkOnly,
  eventTimeWatermark,
} from "causal-order/watermarks"
import { TranslateBatchPolicyError, translateBatch } from "causal-order/translate"
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
    batchOrderEvents,
    compareWithTieBreaker,
    getTieBreaker,
    streamingOrderEventStream,
    createProcessingTimeWatermarkOnly,
    eventTimeWatermark,
    translateBatch,
    validateClock,
    validateEvent,
  ]

  for (const exportedFunction of expectedFunctions) {
    assert.equal(typeof exportedFunction, "function")
  }

  assert.equal(typeof TranslateBatchPolicyError, "function")
})
