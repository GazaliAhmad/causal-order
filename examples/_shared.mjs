import { pathToFileURL } from "node:url"

export function makeEvent(overrides = {}) {
  const {
    id = "evt-1",
    nodeId = "node-a",
    physicalTimeMs = 1_000n,
    logicalCounter = 0,
    payload = { type: "test" },
    ...rest
  } = overrides

  return {
    id,
    nodeId,
    clock: {
      physicalTimeMs,
      logicalCounter,
      nodeId,
    },
    payload,
    ...rest,
  }
}

export function printHeader(title) {
  console.log(`\n=== ${title} ===`)
}

export function printNaiveOrder(events, label = "Naive timestamp order") {
  const ordered = [...events].sort((a, b) => {
    if (a.clock.physicalTimeMs < b.clock.physicalTimeMs) {
      return -1
    }
    if (a.clock.physicalTimeMs > b.clock.physicalTimeMs) {
      return 1
    }
    return 0
  })

  console.log(`${label}:`)
  for (const event of ordered) {
    console.log(`- ${event.id} @ ${event.clock.physicalTimeMs.toString()}`)
  }
}

export function printOrderResult(result) {
  console.log("causal-order output:")
  for (const item of result.ordered) {
    console.log(
      JSON.stringify(
        {
          id: item.event.id,
          orderIndex: item.orderIndex.toString(),
          orderBasis: item.orderBasis,
          confidence: item.confidence,
          causalEvidence: item.causalEvidence ?? [],
        },
        null,
        2,
      ),
    )
  }

  console.log("Concurrent groups:")
  console.log(
    JSON.stringify(
      result.concurrentGroups.map((group) => group.map((event) => event.id)),
      null,
      2,
    ),
  )

  console.log("Anomalies:")
  console.log(
    JSON.stringify(
      result.anomalies.map((anomaly) => ({
        type: anomaly.type,
        severity: anomaly.severity,
        eventId: anomaly.event?.id,
        relatedEventIds: anomaly.relatedEvents?.map((event) => event.id) ?? [],
        message: anomaly.message,
      })),
      null,
      2,
    ),
  )
}

export function isDirectRun(importMetaUrl) {
  if (process.argv[1] === undefined) {
    return false
  }

  return importMetaUrl === pathToFileURL(process.argv[1]).href
}
