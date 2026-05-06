import { makeEvent } from "../helpers/events.mjs"

export function replayCorruptionFixture() {
  const original = makeEvent({
    id: "order-created-1",
    nodeId: "orders-api",
    physicalTimeMs: 1_000n,
    sequence: 1n,
    payload: { type: "order.created" },
    ingestedAt: 1_000n,
  })

  const paymentCaptured = makeEvent({
    id: "payment-captured-1",
    nodeId: "payments-worker",
    physicalTimeMs: 1_100n,
    parentEventId: "order-created-1",
    payload: { type: "payment.captured" },
    ingestedAt: 1_100n,
  })

  const replayedOriginal = makeEvent({
    id: "order-created-1",
    nodeId: "replay-job",
    physicalTimeMs: 1_500n,
    payload: { type: "order.created.replayed" },
    ingestedAt: 2_000n,
  })

  return {
    original,
    paymentCaptured,
    replayedOriginal,
    events: [paymentCaptured, replayedOriginal, original],
  }
}
