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
      id: "access-granted",
      nodeId: "access-service",
      physicalTimeMs: 10_001n,
      dependencyEventIds: ["actor-authenticated", "policy-approved"],
      payload: { type: "access.granted" },
    }),
    makeEvent({
      id: "policy-approved",
      nodeId: "policy-service",
      physicalTimeMs: 10_020n,
      payload: { type: "policy.approved" },
    }),
    makeEvent({
      id: "actor-authenticated",
      nodeId: "auth-service",
      physicalTimeMs: 10_050n,
      payload: { type: "actor.authenticated" },
    }),
  ]

  printHeader("False Audit Timeline")
  console.log("A timestamp-only audit export can look official while still being wrong.")
  printNaiveOrder(events, "Naive clock order")

  const result = orderEvents(events)
  printOrderResult(result)
}

if (isDirectRun(import.meta.url)) {
  run()
}
