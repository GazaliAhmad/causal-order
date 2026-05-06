import { makeEvent } from "../helpers/events.mjs"

export function multiRegionDriftFixture() {
  const apiSingapore = makeEvent({
    id: "evt-sg",
    nodeId: "api-sg-1",
    physicalTimeMs: 2_000n,
    payload: { type: "user.created" },
  })

  const workerUs = makeEvent({
    id: "evt-us",
    nodeId: "worker-us-1",
    physicalTimeMs: 1_950n,
    payload: { type: "email.sent" },
  })

  const dbEu = makeEvent({
    id: "evt-eu",
    nodeId: "db-eu-1",
    physicalTimeMs: 2_010n,
    payload: { type: "billing.initialized" },
  })

  return {
    events: [apiSingapore, workerUs, dbEu],
  }
}
