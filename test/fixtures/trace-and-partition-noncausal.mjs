import { makeEvent } from "../helpers/events.mjs"

export function traceAndPartitionNoncausalFixture() {
  const traceId = "trace-checkout-1"
  const partition = "tenant-42"

  const requestAccepted = makeEvent({
    id: "request-accepted",
    nodeId: "api-gateway",
    physicalTimeMs: 8_000n,
    traceId,
    partition,
    payload: { type: "request.accepted" },
  })

  const inventoryChecked = makeEvent({
    id: "inventory-checked",
    nodeId: "inventory-worker",
    physicalTimeMs: 8_001n,
    traceId,
    partition,
    payload: { type: "inventory.checked" },
  })

  const paymentCaptured = makeEvent({
    id: "payment-captured",
    nodeId: "payments-worker",
    physicalTimeMs: 8_002n,
    traceId,
    partition,
    parentEventId: "request-accepted",
    payload: { type: "payment.captured" },
  })

  return {
    requestAccepted,
    inventoryChecked,
    paymentCaptured,
    events: [inventoryChecked, paymentCaptured, requestAccepted],
  }
}
