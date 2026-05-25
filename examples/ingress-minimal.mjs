import { orderEvents, translateBatch } from "causal-order"
import {
  isDirectRun,
  printHeader,
  printJson,
  printOrderResult,
  printTranslationResult,
} from "./_shared.mjs"

export function run() {
  const records = [
    {
      eventId: "evt-1",
      source: "orders-api",
      occurredAt: "1714971840123",
      sequence: 1n,
      body: { type: "order.created" },
    },
    {
      eventId: "evt-2",
      source: "payments-worker",
      occurredAt: 1714971840125,
      sequence: 1n,
      parent: "evt-1",
      body: { type: "payment.captured" },
    },
  ]

  printHeader("Minimal Ingress")
  console.log("Raw records can flow directly through translateBatch() and into orderEvents().")
  console.log("Raw records:")
  printJson(records)

  const translated = translateBatch(records, {
    getEventId: (record) => record.eventId,
    getNodeId: (record) => record.source,
    getPhysicalTime: (record) => record.occurredAt,
    getSequence: (record) => record.sequence,
    getParentEventId: (record) => record.parent,
    getPayload: (record) => record.body,
  })

  printTranslationResult(translated)

  const ordered = orderEvents(translated.translated, {
    strict: false,
    detectAnomalies: true,
  })

  printOrderResult(ordered)
}

if (isDirectRun(import.meta.url)) {
  run()
}
