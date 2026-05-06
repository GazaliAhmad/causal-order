import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { offlineSyncAnomaliesFixture } from "../fixtures/offline-sync-anomalies.mjs"
import { test } from "../helpers/harness.mjs"

test("offline sync fixture preserves same-node sequence evidence for device history", () => {
  const fixture = offlineSyncAnomaliesFixture()
  const result = orderEvents(fixture.events)

  const deviceEntries = result.ordered.filter((entry) => entry.event.nodeId === "device-1")
  const ids = deviceEntries.map((entry) => entry.event.id)

  assert.deepEqual(ids, [
    "draft-created",
    "draft-edited",
    "draft-submitted",
  ])
  assert.ok(deviceEntries.slice(1).every((entry) => entry.confidence === "proven"))
  assert.ok(deviceEntries.slice(1).every((entry) =>
    entry.causalEvidence?.some((evidence) => evidence.type === "same_node_sequence"),
  ))
})
