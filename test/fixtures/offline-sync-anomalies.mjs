import { makeEvent } from "../helpers/events.mjs"

export function offlineSyncAnomaliesFixture() {
  const draftCreated = makeEvent({
    id: "draft-created",
    nodeId: "device-1",
    physicalTimeMs: 5_000n,
    sequence: 1n,
    payload: { type: "draft.created" },
    ingestedAt: 20_000n,
  })

  const draftEdited = makeEvent({
    id: "draft-edited",
    nodeId: "device-1",
    physicalTimeMs: 5_100n,
    sequence: 2n,
    payload: { type: "draft.edited" },
    ingestedAt: 20_100n,
  })

  const draftSubmitted = makeEvent({
    id: "draft-submitted",
    nodeId: "device-1",
    physicalTimeMs: 5_200n,
    sequence: 3n,
    payload: { type: "draft.submitted" },
    ingestedAt: 20_200n,
  })

  const reviewStarted = makeEvent({
    id: "review-started",
    nodeId: "server-review",
    physicalTimeMs: 19_500n,
    payload: { type: "review.started" },
    ingestedAt: 19_500n,
  })

  return {
    events: [reviewStarted, draftSubmitted, draftCreated, draftEdited],
  }
}
