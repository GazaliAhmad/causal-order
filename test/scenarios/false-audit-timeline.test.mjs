import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { falseAuditTimelineFixture } from "../fixtures/false-audit-timeline.mjs"
import { test } from "../helpers/harness.mjs"

test("false audit timeline fixture prefers explicit dependencies over misleading clock order", () => {
  const fixture = falseAuditTimelineFixture()
  const result = orderEvents(fixture.events)

  const ids = result.ordered.map((entry) => entry.event.id)
  assert.deepEqual(ids, [
    "policy-approved",
    "actor-authenticated",
    "access-granted",
  ])

  const accessGranted = result.ordered.find((entry) => entry.event.id === "access-granted")
  assert.ok(accessGranted)
  assert.equal(accessGranted.confidence, "proven")
  assert.equal(accessGranted.orderBasis, "causal")
})
