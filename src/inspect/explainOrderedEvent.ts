import type { CausalEvidence, OrderedEvent } from "../types.js"

export type OrderedEventExplanation<T = unknown> = {
  eventId: string
  nodeId: string
  orderIndex: bigint
  orderBasis: OrderedEvent<T>["orderBasis"]
  confidence: OrderedEvent<T>["confidence"]
  causalEvidence: readonly CausalEvidence[]
  summary: string
}

export function explainOrderedEvent<T>(
  orderedEvent: Readonly<OrderedEvent<T>>,
): OrderedEventExplanation<T> {
  const causalEvidence = orderedEvent.causalEvidence ?? []
  const summaryParts = [
    `event ${orderedEvent.event.id} ordered at index ${orderedEvent.orderIndex.toString()}`,
    `by ${describeOrderBasis(orderedEvent.orderBasis)}`,
    `with ${orderedEvent.confidence} confidence`,
  ]

  if (causalEvidence.length > 0) {
    summaryParts.push(`evidence: ${causalEvidence.map(formatCausalEvidence).join(", ")}`)
  }

  return {
    eventId: orderedEvent.event.id,
    nodeId: orderedEvent.event.nodeId,
    orderIndex: orderedEvent.orderIndex,
    orderBasis: orderedEvent.orderBasis,
    confidence: orderedEvent.confidence,
    causalEvidence,
    summary: summaryParts.join("; "),
  }
}

function describeOrderBasis(orderBasis: OrderedEvent["orderBasis"]) {
  switch (orderBasis) {
    case "causal":
      return "causal ordering"
    case "hlc":
      return "HLC ordering"
    case "sequence":
      return "same-node sequence ordering"
    case "deterministic_tiebreaker":
      return "deterministic tie-breaker ordering"
    case "ingestion_order":
      return "ingestion-order fallback"
  }
}

function formatCausalEvidence(evidence: CausalEvidence) {
  switch (evidence.type) {
    case "parent_event":
      return `parent_event(${evidence.parentEventId})`
    case "causal_dependency":
      return `causal_dependency(${evidence.dependsOnEventId})`
    case "same_node_sequence":
      return "same_node_sequence"
  }
}
