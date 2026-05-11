import { makeEvent } from "../helpers/events.mjs"

export function streamingRecoveryResyncFixture() {
  const reviewStarted = makeEvent({
    id: "review-started",
    nodeId: "server-review",
    physicalTimeMs: 19_500n,
    payload: { type: "review.started" },
    ingestedAt: 19_500n,
  })

  const notificationSent = makeEvent({
    id: "notification-sent",
    nodeId: "server-notify",
    physicalTimeMs: 19_700n,
    payload: { type: "notification.sent" },
    ingestedAt: 19_700n,
  })

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
    parentEventId: "draft-created",
    payload: { type: "draft.edited" },
    ingestedAt: 20_100n,
  })

  const draftSubmitted = makeEvent({
    id: "draft-submitted",
    nodeId: "device-1",
    physicalTimeMs: 5_200n,
    sequence: 3n,
    parentEventId: "draft-edited",
    payload: { type: "draft.submitted" },
    ingestedAt: 20_200n,
  })

  return {
    events: [
      reviewStarted,
      notificationSent,
      draftCreated,
      draftEdited,
      draftSubmitted,
    ],
  }
}
