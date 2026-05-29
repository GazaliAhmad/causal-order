import assert from "node:assert/strict"

import {
  ingestedAtWatermark,
  orderEvents,
  orderEventStream,
} from "../../dist/index.js"
import { awsInspiredDynamoDbUsEast2015Fixture } from "../fixtures/aws-inspired-dynamodb-us-east-2015.mjs"
import { collectAsync } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("aws-inspired DynamoDB fixture keeps delayed storage history visible as correction-capable late arrivals", async () => {
  const fixture = awsInspiredDynamoDbUsEast2015Fixture()

  async function* source() {
    for (const event of fixture.events) {
      yield event
    }
  }

  const batches = await collectAsync(orderEventStream(source(), {
    batchSize: 50,
    maxLateArrivalMs: 500n,
    lateArrivalPolicy: "emit_correction",
    watermark: ingestedAtWatermark,
    strict: false,
  }))

  const correctionBatches = batches.filter((batch) => batch.correction !== undefined)
  assert.equal(correctionBatches.length, 2)
  assert.deepEqual(
    correctionBatches.map((batch) => batch.correction?.triggerEventId),
    ["storage-07-membership-check", "storage-07-membership-retry"],
  )

  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "late_arrival"),
  ))
  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "invalid_clock"),
  ))

  const firstCorrectionBatch = correctionBatches[0]
  assert.ok(firstCorrectionBatch)
  assert.ok(firstCorrectionBatch?.events.some((entry) => entry.event.id === "storage-07-membership-check"))
  assert.ok(firstCorrectionBatch?.events.some((entry) => entry.event.id === "sqs-request-stalled"))
  assert.ok(firstCorrectionBatch?.events.some((entry) => entry.event.id === "cloudwatch-alarm-lagged"))

  const delayedStorageEntries = batches
    .flatMap((batch) => batch.events)
    .filter((entry) => entry.event.nodeId === "storage-07")

  assert.deepEqual(
    delayedStorageEntries.map((entry) => entry.event.id),
    ["storage-07-membership-check", "storage-07-membership-retry"],
  )
  assert.ok(delayedStorageEntries.every((entry) => entry.orderBasis === "sequence"))
  assert.ok(delayedStorageEntries.every((entry) => entry.confidence === "derived"))
  assert.equal(batches.at(-1)?.isFinal, true)
})

test("aws-inspired DynamoDB fixture surfaces replay duplicates and invalid metadata survivors without crashing batch analysis", () => {
  const fixture = awsInspiredDynamoDbUsEast2015Fixture()
  const result = orderEvents(fixture.reconnectReplayEvents, {
    strict: false,
    detectAnomalies: true,
  })

  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"))
  assert.ok(result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))

  const storageEntries = result.ordered.filter((entry) => entry.event.nodeId === "storage-07")
  assert.deepEqual(
    storageEntries.map((entry) => entry.event.id),
    ["storage-07-membership-check", "storage-07-membership-retry"],
  )
})
