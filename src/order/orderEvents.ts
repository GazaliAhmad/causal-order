import type {
  CausalEvidence,
  EventAnomaly,
  EventEnvelope,
  OrderOptions,
  OrderResult,
  OrderedEvent,
  ValidationResult,
  ValidatedEventEnvelope,
} from "../types.js"
import {
  applyTieBreaker,
} from "../compare/deterministicCompare.js"
import { detectAnomalies } from "../anomalies/detectAnomalies.js"
import {
  compareBigInt,
  compareNullableBigInt,
  compareString,
  dedupeEvidence,
  getValidatedEventTime,
} from "../internal/utils.js"
import { validateEvent } from "../validate/validateEvent.js"

type GraphNode<T> = {
  event: ValidatedEventEnvelope<T>
  index: number
  outgoing: number[]
  outgoingSet?: Set<number>
  indegree: number
  evidence: CausalEvidence[]
  eventTime: bigint
  readyOrder: number
  hasSequenceEvidence: boolean
  isUnresolved: boolean
  sameTimeCount: number
  hasDistinctIngestionOrder: boolean
}

type EventValidationRecord<T> = {
  event: EventEnvelope<T>
  validation: ValidationResult<ValidatedEventEnvelope<T>>
}

const OUTGOING_SET_THRESHOLD = 8

function pushUniqueEdge<T>(
  from: GraphNode<T>,
  toIndex: number,
): boolean {
  const outgoingSet = from.outgoingSet
  if (outgoingSet !== undefined) {
    if (outgoingSet.has(toIndex)) {
      return false
    }

    outgoingSet.add(toIndex)
    from.outgoing.push(toIndex)
    return true
  }

  for (const existingIndex of from.outgoing) {
    if (existingIndex === toIndex) {
      return false
    }
  }

  from.outgoing.push(toIndex)

  if (from.outgoing.length >= OUTGOING_SET_THRESHOLD) {
    from.outgoingSet = new Set(from.outgoing)
  }

  return true
}

function compareGraphNodes<T>(
  a: GraphNode<T>,
  b: GraphNode<T>,
  tieBreaker?: OrderOptions<T>["tieBreaker"],
): number {
  const physical = compareBigInt(a.eventTime, b.eventTime)
  if (physical !== 0) {
    return physical
  }

  const logical = compareNullableBigInt(a.event.sequence, b.event.sequence)
  if (logical !== undefined && logical !== 0) {
    return logical
  }

  if (tieBreaker !== undefined) {
    const tieResult = applyTieBreaker(a.event, b.event, tieBreaker)
    if (tieResult !== 0) {
      return tieResult
    }
  }

  const node = compareString(a.event.nodeId, b.event.nodeId)
  if (node !== 0) {
    return node
  }

  const id = compareString(a.event.id, b.event.id)
  if (id !== 0) {
    return id
  }

  return a.readyOrder - b.readyOrder
}

function pushReadyNode<T>(
  queue: GraphNode<T>[],
  node: GraphNode<T>,
  tieBreaker?: OrderOptions<T>["tieBreaker"],
): void {
  queue.push(node)

  let index = queue.length - 1
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2)
    const parent = queue[parentIndex]
    if (parent === undefined || compareGraphNodes(parent, node, tieBreaker) <= 0) {
      break
    }

    queue[index] = parent
    queue[parentIndex] = node
    index = parentIndex
  }
}

function popReadyNode<T>(
  queue: GraphNode<T>[],
  tieBreaker?: OrderOptions<T>["tieBreaker"],
): GraphNode<T> | undefined {
  const first = queue[0]
  if (first === undefined) {
    return undefined
  }

  const last = queue.pop()
  if (last !== undefined && queue.length > 0) {
    queue[0] = last

    let index = 0
    while (true) {
      const leftIndex = index * 2 + 1
      const rightIndex = leftIndex + 1
      let smallestIndex = index

      const currentEntry = queue[smallestIndex]
      const left = queue[leftIndex]
      if (
        currentEntry !== undefined &&
        left !== undefined &&
        compareGraphNodes(left, currentEntry, tieBreaker) < 0
      ) {
        smallestIndex = leftIndex
      }

      const smallest = queue[smallestIndex]
      const right = queue[rightIndex]
      if (
        smallest !== undefined &&
        right !== undefined &&
        compareGraphNodes(right, smallest, tieBreaker) < 0
      ) {
        smallestIndex = rightIndex
      }

      if (smallestIndex === index) {
        break
      }

      const swapCurrent = queue[index]
      const next = queue[smallestIndex]
      if (swapCurrent === undefined || next === undefined) {
        break
      }

      queue[smallestIndex] = swapCurrent
      queue[index] = next
      index = smallestIndex
    }
  }

  return first
}

function buildOrderedMetadata<T>(
  node: GraphNode<T>,
  orderIndex: bigint,
  tieBreaker?: OrderOptions<T>["tieBreaker"],
): OrderedEvent<T> {
  const { event, evidence, hasSequenceEvidence } = node

  if (node.isUnresolved) {
    return {
      event,
      orderIndex,
      orderBasis: "deterministic_tiebreaker",
      confidence: "unknown",
    }
  }

  if (evidence.length > 0) {
    const causalEvidence = dedupeEvidence(evidence)
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

  if (
    tieBreaker === "ingestion_order" &&
    node.hasDistinctIngestionOrder
  ) {
    return {
      event,
      orderIndex,
      orderBasis: "ingestion_order",
      confidence: "derived",
    }
  }

  if (node.sameTimeCount > 1) {
    return {
      event,
      orderIndex,
      orderBasis: "deterministic_tiebreaker",
      confidence: "fallback",
    }
  }

  return {
    event,
    orderIndex,
    orderBasis: "hlc",
    confidence: "derived",
  }
}

export function orderValidatedEvents<T>(
  validEvents: ValidatedEventEnvelope<T>[],
  options?: OrderOptions<T>,
  internal?: {
    sourceEvents?: EventEnvelope<T>[]
    validations?: EventValidationRecord<T>[]
    anomalies?: EventAnomaly<T>[]
    invalidEvents?: number
  },
): OrderResult<T> {
  const validationOptions: { maxClockDriftMs?: bigint; includeWarnings?: boolean } = {
    includeWarnings: false,
  }
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }

  const strict = options?.strict ?? false
  const sourceEvents = internal?.sourceEvents ?? validEvents
  const validations = internal?.validations
  const anomalies = internal?.anomalies ?? []

  if (validations !== undefined) {
    const detectedAnomalies = detectAnomalies(sourceEvents, {
      ...validationOptions,
      validations,
    })
    for (const anomaly of detectedAnomalies) {
      anomalies.push(anomaly)
    }
  }

  const nodes = validEvents.map<GraphNode<T>>((event, index) => ({
    event,
    index,
    outgoing: [],
    indegree: 0,
    evidence: [],
    eventTime: getValidatedEventTime(event),
    readyOrder: -1,
    hasSequenceEvidence: false,
    isUnresolved: false,
    sameTimeCount: 0,
    hasDistinctIngestionOrder: false,
  }))

  const nodesByEventId = new Map<string, number>()
  const nodesByNodeId = new Map<string, GraphNode<T>[]>()
  const sameTimeEventCounts = new Map<bigint, number>()
  const sameTimeIngestionStates = options?.tieBreaker === "ingestion_order"
    ? new Map<bigint, {
        firstIngestedAt: bigint | undefined
        hasDistinctIngestionOrder: boolean
      }>()
    : undefined

  for (const node of nodes) {
    nodesByEventId.set(node.event.id, node.index)
    const list = nodesByNodeId.get(node.event.nodeId) ?? []
    list.push(node)
    nodesByNodeId.set(node.event.nodeId, list)

    sameTimeEventCounts.set(
      node.eventTime,
      (sameTimeEventCounts.get(node.eventTime) ?? 0) + 1,
    )

    if (sameTimeIngestionStates !== undefined && node.event.ingestedAt !== undefined) {
      const state = sameTimeIngestionStates.get(node.eventTime)
      if (state === undefined) {
        sameTimeIngestionStates.set(node.eventTime, {
          firstIngestedAt: node.event.ingestedAt,
          hasDistinctIngestionOrder: false,
        })
      } else if (
        !state.hasDistinctIngestionOrder &&
        state.firstIngestedAt !== undefined &&
        node.event.ingestedAt !== state.firstIngestedAt
      ) {
        state.hasDistinctIngestionOrder = true
      }
    }
  }

  for (const node of nodes) {
    node.sameTimeCount = sameTimeEventCounts.get(node.eventTime) ?? 0
    if (sameTimeIngestionStates !== undefined && node.event.ingestedAt !== undefined) {
      const state = sameTimeIngestionStates.get(node.eventTime)
      node.hasDistinctIngestionOrder = state?.hasDistinctIngestionOrder ?? false
    }
  }

  for (const node of nodes) {
    const parentEventId = node.event.parentEventId
    if (parentEventId !== undefined) {
      const parentIndex = nodesByEventId.get(parentEventId)
      if (parentIndex !== undefined) {
        const parentNode = nodes[parentIndex]
        if (parentNode !== undefined) {
          if (pushUniqueEdge(parentNode, node.index)) {
            node.indegree += 1
          }
        }
        node.evidence.push({ type: "parent_event", parentEventId })
      }
    }

    for (const dependencyEventId of node.event.dependencyEventIds ?? []) {
      const dependencyIndex = nodesByEventId.get(dependencyEventId)
      if (dependencyIndex !== undefined) {
        const dependencyNode = nodes[dependencyIndex]
        if (dependencyNode !== undefined) {
          if (pushUniqueEdge(dependencyNode, node.index)) {
            node.indegree += 1
          }
        }
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
      .sort((a, b) => {
        const sequenceComparison = compareBigInt(
          a.event.sequence as bigint,
          b.event.sequence as bigint,
        )
        if (sequenceComparison !== 0) {
          return sequenceComparison
        }

        return compareString(a.event.id, b.event.id)
      })

    for (let index = 1; index < withSequence.length; index += 1) {
      const previous = withSequence[index - 1]
      const current = withSequence[index]
      if (
        previous?.event.sequence !== undefined &&
        current?.event.sequence !== undefined &&
        previous.event.sequence < current.event.sequence
      ) {
        if (pushUniqueEdge(previous, current.index)) {
          current.indegree += 1
        }
        current.evidence.push({ type: "same_node_sequence" })
        current.hasSequenceEvidence = true
      }
    }
  }

  const queue: GraphNode<T>[] = []
  let insertionOrder = 0
  for (const node of nodes) {
    if (node.indegree === 0) {
      node.readyOrder = insertionOrder
      pushReadyNode(queue, node, options?.tieBreaker)
      insertionOrder += 1
    }
  }

  const orderedNodes: GraphNode<T>[] = []
  const isOrdered = new Array<boolean>(nodes.length).fill(false)
  while (queue.length > 0) {
    const current = popReadyNode(queue, options?.tieBreaker)
    if (current === undefined) {
      break
    }

    orderedNodes.push(current)
    isOrdered[current.index] = true

    for (const outgoingIndex of current.outgoing) {
      const target = nodes[outgoingIndex]
      if (target === undefined) {
        continue
      }
      target.indegree -= 1
      if (target.indegree === 0) {
        target.readyOrder = insertionOrder
        pushReadyNode(queue, target, options?.tieBreaker)
        insertionOrder += 1
      }
    }
  }

  if (orderedNodes.length !== nodes.length && strict) {
    throw new Error("Unable to produce a complete ordering from the provided events")
  }

  const unresolvedNodes = nodes
    .filter((node) => !isOrdered[node.index])
    .sort((a, b) => compareGraphNodes(a, b, options?.tieBreaker))

  for (const node of unresolvedNodes) {
    if (!isOrdered[node.index]) {
      node.isUnresolved = true
      anomalies.push({
        type: "unknown_order",
        severity: options?.allowUnknownOrder === false ? "error" : "warning",
        event: node.event,
        message: "Event could not be fully placed by causal ordering and was appended deterministically",
      })
      orderedNodes.push(node)
      isOrdered[node.index] = true
    }
  }

  const ordered = orderedNodes.map((node, index) =>
    buildOrderedMetadata(node, BigInt(index), options?.tieBreaker))

  return {
    ordered,
    anomalies,
    stats: {
      totalEvents: sourceEvents.length,
      validEvents: validEvents.length,
      invalidEvents: internal?.invalidEvents ?? (sourceEvents.length - validEvents.length),
      orderedEvents: ordered.length,
      anomalyCount: anomalies.length,
    },
  }
}

export function orderEvents<T>(
  events: EventEnvelope<T>[],
  options?: OrderOptions<T>,
): OrderResult<T> {
  const validationOptions: { maxClockDriftMs?: bigint; includeWarnings?: boolean } = {
    includeWarnings: false,
  }
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }

  const strict = options?.strict ?? false
  const detectAnomaliesEnabled = options?.detectAnomalies !== false
  const validations = detectAnomaliesEnabled
    ? new Array<EventValidationRecord<T>>()
    : undefined
  const anomalies: EventAnomaly<T>[] = []

  const validEvents: ValidatedEventEnvelope<T>[] = []
  for (const event of events) {
    const validation = validateEvent(event, validationOptions) as ValidationResult<ValidatedEventEnvelope<T>>
    if (validations !== undefined) {
      validations.push({
        event,
        validation,
      })
    }

    if (!validation.valid) {
      if (strict) {
        throw new Error(
          `Invalid event ${event.id || "<unknown>"}: ${validation.errors
            .map((error) => error.message)
            .join("; ")}`,
        )
      }

      if (!detectAnomaliesEnabled) {
        anomalies.push({
          type: "invalid_clock",
          severity: "error",
          event,
          message: validation.errors.map((error) => error.message).join("; "),
        })
      }
      continue
    }

    validEvents.push(validation.value)
  }

  const internalOptions: {
    sourceEvents: EventEnvelope<T>[]
    validations?: EventValidationRecord<T>[]
    anomalies: EventAnomaly<T>[]
    invalidEvents: number
  } = {
    sourceEvents: events,
    anomalies,
    invalidEvents: events.length - validEvents.length,
  }

  if (validations !== undefined) {
    internalOptions.validations = validations
  }

  return orderValidatedEvents(validEvents, options, internalOptions)
}
