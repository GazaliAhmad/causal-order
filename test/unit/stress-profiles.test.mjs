import assert from "node:assert/strict"

import { orderEvents } from "../../dist/index.js"
import { stressBenchmarkProfiles } from "../../perf/stress-profiles.mjs"
import { test } from "../helpers/harness.mjs"

const stressCases = [
  {
    profileName: "stress-150k-duplicate-explosion",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"))
    },
  },
  {
    profileName: "stress-150k-inversion-chains",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "causal_inversion"))
    },
  },
  {
    profileName: "stress-150k-malformed-ratios",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "invalid_clock"))
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "missing_sequence"))
    },
  },
  {
    profileName: "stress-150k-sparse-causality",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "missing_sequence"))
      assert.ok(result.ordered.some((entry) => entry.orderBasis === "hlc"))
    },
  },
  {
    profileName: "stress-150k-same-timestamp-clusters",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "missing_sequence"))
      assert.ok(result.ordered.some((entry) => entry.confidence === "fallback"))
    },
  },
  {
    profileName: "stress-150k-replay-storms",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "duplicate_event"))
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "causal_inversion"))
    },
  },
  {
    profileName: "stress-150k-cyclic-dependencies",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "unknown_order"))
      assert.ok(result.ordered.some((entry) => entry.confidence === "unknown"))
    },
  },
  {
    profileName: "stress-150k-sequence-conflicts",
    assertResult(result) {
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "same_node_sequence_conflict"))
      assert.ok(result.anomalies.some((anomaly) => anomaly.type === "sequence_regression"))
    },
  },
]

test("stress benchmark profiles survive smaller verification runs and surface their expected signals", () => {
  for (const stressCase of stressCases) {
    const baseProfile = stressBenchmarkProfiles[stressCase.profileName]
    const profile = {
      ...baseProfile,
      totalEvents: 480,
      nodeCount: 12,
    }
    const events = profile.createEvents(profile)
    const result = orderEvents(events, {
      strict: false,
      detectAnomalies: profile.detectAnomalies,
    })

    assert.equal(events.length, 480, `${stressCase.profileName} should generate the requested event count`)
    assert.equal(result.stats.totalEvents, 480)
    assert.equal(result.stats.orderedEvents, result.ordered.length)
    assert.ok(result.stats.validEvents > 0, `${stressCase.profileName} should retain some valid events`)

    stressCase.assertResult(result)
  }
})
