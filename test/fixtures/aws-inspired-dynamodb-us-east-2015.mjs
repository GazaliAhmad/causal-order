import { makeEvent } from "../helpers/events.mjs"

export function awsInspiredDynamoDbUsEast2015Fixture() {
  const metadataMembershipOverloaded = makeEvent({
    id: "metadata-membership-overloaded",
    nodeId: "metadata-service",
    physicalTimeMs: 19_000n,
    sequence: 1n,
    payload: {
      type: "metadata.membership_overloaded",
      note: "membership fetches slow down after index metadata grows",
    },
    ingestedAt: 19_000n,
  })

  const storage12Withdrew = makeEvent({
    id: "storage-12-withdrew",
    nodeId: "storage-12",
    physicalTimeMs: 19_100n,
    sequence: 44n,
    parentEventId: "storage-12-healthy",
    dependencyEventIds: ["metadata-membership-overloaded"],
    payload: {
      type: "storage.self_disqualified",
      reason: "membership_timeout",
    },
    ingestedAt: 19_100n,
  })

  const sqsRequestStalled = makeEvent({
    id: "sqs-request-stalled",
    nodeId: "sqs",
    physicalTimeMs: 19_200n,
    dependencyEventIds: ["storage-12-withdrew"],
    payload: {
      type: "sqs.request_stalled",
    },
    ingestedAt: 19_200n,
  })

  const autoScalingHealthDelayed = makeEvent({
    id: "autoscaling-health-delayed",
    nodeId: "autoscaling",
    physicalTimeMs: 19_250n,
    dependencyEventIds: ["storage-12-withdrew"],
    payload: {
      type: "autoscaling.health_delayed",
    },
    ingestedAt: 19_250n,
  })

  const cloudWatchAlarmLagged = makeEvent({
    id: "cloudwatch-alarm-lagged",
    nodeId: "cloudwatch",
    physicalTimeMs: 19_300n,
    dependencyEventIds: ["autoscaling-health-delayed"],
    payload: {
      type: "cloudwatch.alarm_lagged",
    },
    ingestedAt: 19_300n,
  })

  const consoleStatusStale = makeEvent({
    id: "console-status-stale",
    nodeId: "aws-console",
    physicalTimeMs: 19_350n,
    dependencyEventIds: ["metadata-membership-overloaded"],
    payload: {
      type: "console.status_stale",
    },
    ingestedAt: 19_350n,
  })

  const metadataCapacityAdded = makeEvent({
    id: "metadata-capacity-added",
    nodeId: "metadata-service",
    physicalTimeMs: 19_400n,
    logicalCounter: 1,
    sequence: 2n,
    parentEventId: "metadata-membership-overloaded",
    payload: {
      type: "metadata.capacity_added",
      note: "capacity is restored before delayed storage history catches up",
    },
    ingestedAt: 19_400n,
  })

  const storage07MembershipCheck = makeEvent({
    id: "storage-07-membership-check",
    nodeId: "storage-07",
    physicalTimeMs: 5_000n,
    sequence: 1n,
    payload: {
      type: "storage.membership_check",
      note: "this happened before the visible fallout but arrived much later",
    },
    ingestedAt: 20_000n,
  })

  const storage07MembershipRetry = makeEvent({
    id: "storage-07-membership-retry",
    nodeId: "storage-07",
    physicalTimeMs: 5_050n,
    sequence: 2n,
    parentEventId: "storage-07-membership-check",
    payload: {
      type: "storage.membership_retry",
    },
    ingestedAt: 20_050n,
  })

  const storage07MembershipCorrupt = makeEvent({
    id: "storage-07-membership-corrupt",
    nodeId: "storage-07",
    physicalTimeMs: 5_075n,
    logicalCounter: -1,
    sequence: 3n,
    parentEventId: "storage-07-membership-retry",
    payload: {
      type: "storage.membership_corrupt",
    },
    ingestedAt: 20_060n,
  })

  const replayedMembershipRetry = makeEvent({
    id: "storage-07-membership-retry",
    nodeId: "replay-worker",
    physicalTimeMs: 5_500n,
    sequence: 1n,
    payload: {
      type: "storage.membership_retry.replayed",
    },
    ingestedAt: 20_090n,
  })

  return {
    metadataMembershipOverloaded,
    storage12Withdrew,
    sqsRequestStalled,
    autoScalingHealthDelayed,
    cloudWatchAlarmLagged,
    consoleStatusStale,
    metadataCapacityAdded,
    storage07MembershipCheck,
    storage07MembershipRetry,
    storage07MembershipCorrupt,
    replayedMembershipRetry,
    events: [
      metadataMembershipOverloaded,
      storage12Withdrew,
      sqsRequestStalled,
      autoScalingHealthDelayed,
      cloudWatchAlarmLagged,
      consoleStatusStale,
      metadataCapacityAdded,
      storage07MembershipCheck,
      storage07MembershipRetry,
      storage07MembershipCorrupt,
    ],
    reconnectReplayEvents: [
      storage07MembershipRetry,
      replayedMembershipRetry,
      storage07MembershipCorrupt,
      storage07MembershipCheck,
    ],
  }
}
