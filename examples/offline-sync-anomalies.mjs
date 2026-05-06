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
      id: "review-started",
      nodeId: "server-review",
      physicalTimeMs: 19_500n,
      payload: { type: "review.started" },
      ingestedAt: 19_500n,
    }),
    makeEvent({
      id: "draft-submitted",
      nodeId: "device-1",
      physicalTimeMs: 5_200n,
      sequence: 3n,
      payload: { type: "draft.submitted" },
      ingestedAt: 20_200n,
    }),
    makeEvent({
      id: "draft-created",
      nodeId: "device-1",
      physicalTimeMs: 5_000n,
      sequence: 1n,
      payload: { type: "draft.created" },
      ingestedAt: 20_000n,
    }),
    makeEvent({
      id: "draft-edited",
      nodeId: "device-1",
      physicalTimeMs: 5_100n,
      sequence: 2n,
      payload: { type: "draft.edited" },
      ingestedAt: 20_100n,
    }),
  ]

  printHeader("Offline Sync Anomalies")
  console.log("A device history can arrive late and still carry a stronger local sequence truth.")
  printNaiveOrder(events, "Naive clock order")

  const result = orderEvents(events)
  printOrderResult(result)
}

if (isDirectRun(import.meta.url)) {
  run()
}
