import assert from "node:assert/strict"

import {
  ingestedAtWatermark,
  orderEventStream,
} from "../../dist/index.js"
import { streamingRecoveryResyncFixture } from "../fixtures/streaming-recovery-resync.mjs"
import { collectAsync } from "../helpers/events.mjs"
import { test } from "../helpers/harness.mjs"

test("streaming recovery fixture surfaces correction-capable late arrivals during delayed reconnect", async () => {
  const fixture = streamingRecoveryResyncFixture()

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

  assert.ok(batches.length >= 3)
  assert.ok(batches.some((batch) =>
    batch.anomalies.some((anomaly) => anomaly.type === "late_arrival"),
  ))

  const firstReconnectBatch = batches.find((batch) =>
    batch.events.some((entry) => entry.event.id === "draft-created"),
  )
  assert.ok(firstReconnectBatch)
  assert.equal(firstReconnectBatch?.isFinal, false)

  const reconnectEntries = batches
    .flatMap((batch) => batch.events)
    .filter((entry) => entry.event.nodeId === "device-1")
  const reconnectIds = reconnectEntries.map((entry) => entry.event.id)
  assert.deepEqual(reconnectIds, [
    "draft-created",
    "draft-edited",
    "draft-submitted",
  ])

  assert.ok(reconnectEntries.every((entry) => entry.orderBasis === "sequence"))
  assert.ok(reconnectEntries.every((entry) => entry.confidence === "derived"))

  assert.equal(batches.at(-1)?.isFinal, true)
})
