import { makeEvent } from "../helpers/events.mjs"

export function falseAuditTimelineFixture() {
  const authenticated = makeEvent({
    id: "actor-authenticated",
    nodeId: "auth-service",
    physicalTimeMs: 10_050n,
    payload: { type: "actor.authenticated" },
  })

  const approved = makeEvent({
    id: "policy-approved",
    nodeId: "policy-service",
    physicalTimeMs: 10_020n,
    payload: { type: "policy.approved" },
  })

  const granted = makeEvent({
    id: "access-granted",
    nodeId: "access-service",
    physicalTimeMs: 10_001n,
    dependencyEventIds: ["actor-authenticated", "policy-approved"],
    payload: { type: "access.granted" },
  })

  return {
    authenticated,
    approved,
    granted,
    events: [granted, approved, authenticated],
  }
}
