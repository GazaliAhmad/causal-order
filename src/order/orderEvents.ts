import type {
  CausalEvidence,
  EventAnomaly,
  EventEnvelope,
  OrderOptions,
  OrderResult,
  OrderedEvent,
} from "../types.js"
import { compareByCausality } from "../compare/causalCompare.js"
import { compareByHlc } from "../compare/hlcCompare.js"
import { compareDeterministically } from "../compare/deterministicCompare.js"
import { detectAnomalies } from "../anomalies/detectAnomalies.js"
import { dedupeEvidence } from "../internal/utils.js"
import { validateEvent } from "../validate/validateEvent.js"

type GraphNode<T> = {
  event: EventEnvelope<T>
  index: number
  outgoing: number[]
  indegree: number
  evidence: CausalEvidence[]
}

function pushUniqueEdge<T>(
  from: GraphNode<T>,
  toIndex: number,
): void {
  if (!from.outgoing.includes(toIndex)) {
    from.outgoing.push(toIndex)
  }
}

function buildOrderedMetadata<T>(
  event: EventEnvelope<T>,
  orderIndex: bigint,
  evidence: CausalEvidence[],
): OrderedEvent<T> {
  const causalEvidence = dedupeEvidence(evidence)

  if (causalEvidence.length > 0) {
    const hasSequenceEvidence = causalEvidence.some(
      (item) => item.type === "same_node_sequence",
    )
    return {
      event,
      orderIndex,
      orderBasis: hasSequenceEvidence ? "sequence" : "causal",
      confidence: "proven",
      causalEvidence,
    }
  }

  if (event.sequence !== undefined) {
    return {
      event,
      orderIndex,
      orderBasis: "sequence",
      confidence: "derived",
    }
  }

  const hlcOrder = compareByHlc(event.clock, event.clock)
  if (hlcOrder !== "unknown") {
    return {
      event,
      orderIndex,
      orderBasis: "hlc",
      confidence: "derived",
    }
  }

  if (event.ingestedAt !== undefined) {
    return {
      event,
      orderIndex,
      orderBasis: "ingestion_order",
      confidence: "derived",
    }
  }

  return {
    event,
    orderIndex,
    orderBasis: "deterministic_tiebreaker",
    confidence: "fallback",
  }
}

function collectConcurrentGroups<T>(
  orderedEvents: EventEnvelope<T>[],
): EventEnvelope<T>[][] {
  const groups: EventEnvelope<T>[][] = []
  let currentGroup: EventEnvelope<T>[] = []

  for (const event of orderedEvents) {
    const previous = currentGroup[currentGroup.length - 1]
    if (previous === undefined) {
      currentGroup.push(event)
      continue
    }

    if (compareByCausality(previous, event) === "concurrent") {
      currentGroup.push(event)
      continue
    }

    if (currentGroup.length > 1) {
      groups.push(currentGroup)
    }
    currentGroup = [event]
  }

  if (currentGroup.length > 1) {
    groups.push(currentGroup)
  }

  return groups
}

export function orderEvents<T>(
  events: EventEnvelope<T>[],
  options?: OrderOptions<T>,
): OrderResult<T> {
  const validationOptions: { maxClockDriftMs?: bigint } = {}
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }

  const strict = options?.strict ?? false
  const anomalies: EventAnomaly<T>[] = options?.detectAnomalies === false
    ? []
    : detectAnomalies(events, validationOptions)

  const validEvents: EventEnvelope<T>[] = []
  for (const event of events) {
    const validation = validateEvent(event, validationOptions)
    if (!validation.valid) {
      if (strict) {
        throw new Error(
          `Invalid event ${event.id || "<unknown>"}: ${validation.errors
            .map((error) => error.message)
            .join("; ")}`,
        )
      }

      if (options?.detectAnomalies === false) {
        anomalies.push({
          type: "invalid_clock",
          severity: "error",
          event,
          message: validation.errors.map((error) => error.message).join("; "),
        })
      }
      continue
    }

    validEvents.push(event)
  }

  const nodes = validEvents.map<GraphNode<T>>((event, index) => ({
    event,
    index,
    outgoing: [],
    indegree: 0,
    evidence: [],
  }))

  const nodesByEventId = new Map(validEvents.map((event, index) => [event.id, index]))
  const nodesByNodeId = new Map<string, GraphNode<T>[]>()

  for (const node of nodes) {
    const list = nodesByNodeId.get(node.event.nodeId) ?? []
    list.push(node)
    nodesByNodeId.set(node.event.nodeId, list)
  }

  for (const node of nodes) {
    const parentEventId = node.event.parentEventId
    if (parentEventId !== undefined) {
      const parentIndex = nodesByEventId.get(parentEventId)
      if (parentIndex !== undefined) {
        const parentNode = nodes[parentIndex]
        if (parentNode !== undefined) {
          pushUniqueEdge(parentNode, node.index)
        }
        node.indegree += 1
        node.evidence.push({ type: "parent_event", parentEventId })
      }
    }

    for (const dependencyEventId of node.event.dependencyEventIds ?? []) {
      const dependencyIndex = nodesByEventId.get(dependencyEventId)
      if (dependencyIndex !== undefined) {
        const dependencyNode = nodes[dependencyIndex]
        if (dependencyNode !== undefined) {
          pushUniqueEdge(dependencyNode, node.index)
        }
        node.indegree += 1
        node.evidence.push({
          type: "causal_dependency",
          dependsOnEventId: dependencyEventId,
        })
      }
    }
  }

  for (const [, sameNodeEvents] of nodesByNodeId) {
    const withSequence = sameNodeEvents
      .filter((node) => node.event.sequence !== undefined)
      .sort((a, b) => compareDeterministically(a.event, b.event, "sequence"))

    for (let index = 1; index < withSequence.length; index += 1) {
      const previous = withSequence[index - 1]
      const current = withSequence[index]
      if (
        previous?.event.sequence !== undefined &&
        current?.event.sequence !== undefined &&
        previous.event.sequence < current.event.sequence
      ) {
        pushUniqueEdge(previous, current.index)
        current.indegree += 1
        current.evidence.push({ type: "same_node_sequence" })
      }
    }
  }

  const queue = nodes
    .filter((node) => node.indegree === 0)
    .sort((a, b) => compareDeterministically(a.event, b.event, options?.tieBreaker))

  const orderedNodes: GraphNode<T>[] = []
  while (queue.length > 0) {
    const current = queue.shift()
    if (current === undefined) {
      break
    }

    orderedNodes.push(current)

    for (const outgoingIndex of current.outgoing) {
      const target = nodes[outgoingIndex]
      if (target === undefined) {
        continue
      }
      target.indegree -= 1
      if (target.indegree === 0) {
        queue.push(target)
        queue.sort((a, b) => compareDeterministically(a.event, b.event, options?.tieBreaker))
      }
    }
  }

  if (orderedNodes.length !== nodes.length && strict) {
    throw new Error("Unable to produce a complete ordering from the provided events")
  }

  for (const node of nodes) {
    if (!orderedNodes.includes(node)) {
      anomalies.push({
        type: "unknown_order",
        severity: options?.allowUnknownOrder === false ? "error" : "warning",
        event: node.event,
        message: "Event could not be fully placed by causal ordering and was appended deterministically",
      })
      orderedNodes.push(node)
    }
  }

  const ordered = orderedNodes.map((node, index) =>
    buildOrderedMetadata(node.event, BigInt(index), node.evidence))
  const concurrentGroups = collectConcurrentGroups(ordered.map((item) => item.event))

  return {
    ordered,
    concurrentGroups,
    anomalies,
    stats: {
      totalEvents: events.length,
      validEvents: validEvents.length,
      invalidEvents: events.length - validEvents.length,
      orderedEvents: ordered.length,
      concurrentGroupCount: concurrentGroups.length,
      anomalyCount: anomalies.length,
    },
  }
}
