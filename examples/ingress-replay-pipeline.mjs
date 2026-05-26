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
      eventId: "payment-captured",
      source: "payments-worker",
      occurredAt: 1100,
      parent: "order-created",
      body: { type: "payment.captured" },
    },
    {
      eventId: "order-created",
      source: "replay-job",
      occurredAt: "1500",
      body: { type: "order.created.replayed" },
    },
    {
      eventId: "order-created",
      source: "orders-api",
      occurredAt: 1000n,
      sequence: 1n,
      body: { type: "order.created" },
    },
    {
      eventId: "broken-export-row",
      source: "legacy-export",
      occurredAt: "2024-05-06T12:24:00Z",
      body: { type: "order.created" },
    },
  ]

  printHeader("Ingress Replay Pipeline")
  console.log("Raw replay exports can contain both rejected rows and replayed duplicates.")
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
