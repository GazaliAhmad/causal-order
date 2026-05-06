import { makeEvent } from "../helpers/events.mjs"

export function causalInversionFixture() {
  const parent = makeEvent({
    id: "request-received",
    nodeId: "api-1",
    physicalTimeMs: 10_050n,
    payload: { type: "request.received" },
  })

  const child = makeEvent({
    id: "invoice-created",
    nodeId: "billing-1",
    physicalTimeMs: 10_001n,
    parentEventId: "request-received",
    payload: { type: "invoice.created" },
  })

  return {
    parent,
    child,
    events: [child, parent],
  }
}
