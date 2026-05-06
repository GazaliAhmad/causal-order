import { orderEvents } from "../dist/index.js"
import {
  isDirectRun,
  makeEvent,
  printHeader,
  printNaiveOrder,
  printOrderResult,
} from "./_shared.mjs"

export function run() {
  const events = [
    makeEvent({
      id: "payment-captured",
      nodeId: "payments-worker",
      physicalTimeMs: 1_100n,
      parentEventId: "order-created",
      payload: { type: "payment.captured" },
      ingestedAt: 1_100n,
    }),
    makeEvent({
      id: "order-created",
      nodeId: "replay-job",
      physicalTimeMs: 1_500n,
      payload: { type: "order.created.replayed" },
      ingestedAt: 2_000n,
    }),
    makeEvent({
      id: "order-created",
      nodeId: "orders-api",
      physicalTimeMs: 1_000n,
      sequence: 1n,
      payload: { type: "order.created" },
      ingestedAt: 1_000n,
    }),
  ]

  printHeader("Replay Corruption")
  console.log("Old events are replayed with fresh-looking timestamps or ingestion metadata.")
  printNaiveOrder(events, "Naive clock order")

  const result = orderEvents(events, {
    strict: false,
    detectAnomalies: true,
  })

  printOrderResult(result)
}

if (isDirectRun(import.meta.url)) {
  run()
}
