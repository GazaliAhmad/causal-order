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
      id: "invoice-created",
      nodeId: "billing-1",
      physicalTimeMs: 10_001n,
      parentEventId: "request-received",
      payload: { type: "invoice.created" },
    }),
    makeEvent({
      id: "request-received",
      nodeId: "api-1",
      physicalTimeMs: 10_050n,
      payload: { type: "request.received" },
    }),
  ]

  printHeader("Causal Inversion")
  console.log("The child looks earlier by clock time, but explicit causal evidence says otherwise.")
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
