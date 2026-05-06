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
      id: "user-created",
      nodeId: "api-sg-1",
      physicalTimeMs: 2_000n,
      payload: { type: "user.created" },
    }),
    makeEvent({
      id: "email-sent",
      nodeId: "worker-us-1",
      physicalTimeMs: 1_950n,
      payload: { type: "email.sent" },
    }),
    makeEvent({
      id: "billing-initialized",
      nodeId: "db-eu-1",
      physicalTimeMs: 2_010n,
      payload: { type: "billing.initialized" },
    }),
  ]

  printHeader("Multi-Region Drift")
  console.log("Different regions emit believable timestamps that do not prove causal truth.")
  printNaiveOrder(events, "Naive clock order")

  const result = orderEvents(events)
  printOrderResult(result)
}

if (isDirectRun(import.meta.url)) {
  run()
}
