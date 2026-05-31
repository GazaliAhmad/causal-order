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
  explainOrderedEvent,
  inspectOrderBatch,
  inspectOrderResult,
  summarizeEventAnomalies,
  summarizeTranslationAnomalies,
} from "causal-order/inspect"
import {
  orderEvents,
  orderEventStream,
  createProcessingTimeWatermark,
} from "causal-order/order"
import {
  orderEvents as batchOrderEvents,
  DEFAULT_TIE_BREAKER,
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

test("package subpath exports expose focused runtime entrypoints", async () => {
  const expectedFunctions = [
    createHlcClock,
    parseHlc,
    serializeHlc,
    compareByCausality,
    compareByHlc,
    compareDeterministically,
    detectAnomalies,
    explainOrderedEvent,
    orderEvents,
    orderEventStream,
    createProcessingTimeWatermark,
    batchOrderEvents,
    getTieBreaker,
    streamingOrderEventStream,
    createProcessingTimeWatermarkOnly,
    eventTimeWatermark,
    inspectOrderBatch,
    inspectOrderResult,
    summarizeEventAnomalies,
    summarizeTranslationAnomalies,
    translateBatch,
    validateClock,
    validateEvent,
  ]

  for (const exportedFunction of expectedFunctions) {
    assert.equal(typeof exportedFunction, "function")
  }

  assert.equal(typeof TranslateBatchPolicyError, "function")
  assert.equal(DEFAULT_TIE_BREAKER, "event_id")

  const compareSubpath = await import("causal-order/compare")
  const batchSubpath = await import("causal-order/batch")

  assert.equal("compareClocks" in compareSubpath, false)
  assert.equal("compareWithTieBreaker" in batchSubpath, false)
})
