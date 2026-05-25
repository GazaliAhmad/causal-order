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

function displayReplacer(_key, value) {
  if (typeof value === "bigint") {
    return value.toString()
  }

  return value
}

export function printJson(value) {
  console.log(JSON.stringify(value, displayReplacer, 2))
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
    printJson({
      id: item.event.id,
      orderIndex: item.orderIndex.toString(),
      orderBasis: item.orderBasis,
      confidence: item.confidence,
      causalEvidence: item.causalEvidence ?? [],
    })
  }

  console.log("Anomalies:")
  printJson(
    result.anomalies.map((anomaly) => ({
      type: anomaly.type,
      severity: anomaly.severity,
      eventId: anomaly.event?.id,
      relatedEventIds: anomaly.relatedEvents?.map((event) => event.id) ?? [],
      message: anomaly.message,
    })),
  )
}

export function printTranslationResult(result) {
  console.log("Translated envelopes:")
  printJson(
    result.translated.map((event) => ({
      id: event.id,
      nodeId: event.nodeId,
      physicalTimeMs: event.clock.physicalTimeMs,
      sequence: event.sequence ?? null,
      parentEventId: event.parentEventId ?? null,
      payload: event.payload,
    })),
  )

  console.log("Translation anomalies:")
  printJson(
    result.anomalies.map((anomaly) => ({
      code: anomaly.code,
      field: anomaly.field,
      stage: anomaly.stage,
      mapper: anomaly.mapper,
      message: anomaly.message,
      policy: anomaly.policy,
      classification: anomaly.classification,
      expected: anomaly.expected,
      actualType: anomaly.actualType,
      index: anomaly.index,
    })),
  )
}

export function isDirectRun(importMetaUrl) {
  if (process.argv[1] === undefined) {
    return false
  }

  return importMetaUrl === pathToFileURL(process.argv[1]).href
}
