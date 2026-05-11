import {
  ingestedAtWatermark,
  orderEventStream,
} from "../dist/index.js"
import {
  isDirectRun,
  makeEvent,
  printHeader,
} from "./_shared.mjs"

async function* source() {
  yield makeEvent({
    id: "review-started",
    nodeId: "server-review",
    physicalTimeMs: 19_500n,
    payload: { type: "review.started" },
    ingestedAt: 19_500n,
  })
  yield makeEvent({
    id: "notification-sent",
    nodeId: "server-notify",
    physicalTimeMs: 19_700n,
    payload: { type: "notification.sent" },
    ingestedAt: 19_700n,
  })
  yield makeEvent({
    id: "draft-created",
    nodeId: "device-1",
    physicalTimeMs: 5_000n,
    sequence: 1n,
    payload: { type: "draft.created" },
    ingestedAt: 20_000n,
  })
  yield makeEvent({
    id: "draft-edited",
    nodeId: "device-1",
    physicalTimeMs: 5_100n,
    sequence: 2n,
    parentEventId: "draft-created",
    payload: { type: "draft.edited" },
    ingestedAt: 20_100n,
  })
  yield makeEvent({
    id: "draft-submitted",
    nodeId: "device-1",
    physicalTimeMs: 5_200n,
    sequence: 3n,
    parentEventId: "draft-edited",
    payload: { type: "draft.submitted" },
    ingestedAt: 20_200n,
  })
}

export async function run() {
  printHeader("Streaming Recovery Resync")
  console.log("Delayed reconnect batches can be operationally late without losing device-local causal truth.")

  for await (const batch of orderEventStream(source(), {
    batchSize: 50,
    maxLateArrivalMs: 500n,
    lateArrivalPolicy: "emit_correction",
    watermark: ingestedAtWatermark,
    strict: false,
  })) {
    console.log(JSON.stringify({
      watermark: batch.watermark.toString(),
      isFinal: batch.isFinal,
      events: batch.events.map((entry) => ({
        id: entry.event.id,
        orderBasis: entry.orderBasis,
        confidence: entry.confidence,
      })),
      anomalies: batch.anomalies.map((anomaly) => ({
        type: anomaly.type,
        severity: anomaly.severity,
        eventId: anomaly.event?.id,
      })),
    }, null, 2))
  }
}

if (isDirectRun(import.meta.url)) {
  await run()
}
