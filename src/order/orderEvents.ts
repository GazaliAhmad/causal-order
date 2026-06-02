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
import type {
  EventValidationRecord,
  OrderValidatedEventsInternalOptions,
} from "./internalOrderValidatedEvents.js"
import {
  applyTieBreaker,
} from "../compare/deterministicCompare.js"
import { createAnomalyCollector } from "../anomalies/internalAnomalyCollector.js"
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
  evidence?: CausalEvidence[]
  eventTime: bigint
  readyOrder: number
  hasSequenceEvidence: boolean
  isUnresolved: boolean
}

type SameTimeState = {
  count: number
  firstIngestedAt: bigint | undefined
  hasDistinctIngestionOrder: boolean
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

function pushEvidence<T>(
  node: GraphNode<T>,
  evidence: CausalEvidence,
): void {
  if (node.evidence === undefined) {
    node.evidence = [evidence]
    return
  }

  node.evidence.push(evidence)
}

function compareSameNodeSequence<T>(
  a: GraphNode<T>,
  b: GraphNode<T>,
): number {
  const aSequence = a.event.sequence
  const bSequence = b.event.sequence

  if (aSequence === undefined) {
    if (bSequence === undefined) {
      return compareString(a.event.id, b.event.id)
    }
    return 1
  }

  if (bSequence === undefined) {
    return -1
  }

  const sequenceComparison = compareBigInt(aSequence, bSequence)
  if (sequenceComparison !== 0) {
    return sequenceComparison
  }

  return compareString(a.event.id, b.event.id)
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
  sameTimeCount = 1,
  hasDistinctIngestionOrder = false,
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

  if (evidence !== undefined && evidence.length > 0) {
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
    hasDistinctIngestionOrder
  ) {
    return {
      event,
      orderIndex,
      orderBasis: "ingestion_order",
      confidence: "derived",
    }
  }

  if (sameTimeCount > 1) {
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

function createValidationRecordsForValidatedEvents<T>(
  validEvents: ValidatedEventEnvelope<T>[],
  validationOptions: { maxClockDriftMs?: bigint; includeWarnings?: boolean },
): EventValidationRecord<T>[] {
  return validEvents.map((event) => ({
    event,
    validation: validateEvent(event, validationOptions) as ValidationResult<ValidatedEventEnvelope<T>>,
  }))
}

function orderValidatedEventsCore<T>(
  validEvents: ValidatedEventEnvelope<T>[],
  options?: OrderOptions<T>,
  internal?: OrderValidatedEventsInternalOptions<T>,
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
    if (detectedAnomalies.length > 0) {
      anomalies.push(...detectedAnomalies)
    }
  }

  const nodes = validEvents.map<GraphNode<T>>((event, index) => ({
    event,
    index,
    outgoing: [],
    indegree: 0,
    eventTime: getValidatedEventTime(event),
    readyOrder: -1,
    hasSequenceEvidence: false,
    isUnresolved: false,
  }))

  const nodesByEventId = new Map<string, number>()
  const nodesByNodeId = new Map<string, GraphNode<T>[]>()
  const sameTimeStates = new Map<bigint, SameTimeState>()
  const trackIngestionOrder = options?.tieBreaker === "ingestion_order"

  for (const node of nodes) {
    nodesByEventId.set(node.event.id, node.index)
    const list = nodesByNodeId.get(node.event.nodeId) ?? []
    list.push(node)
    nodesByNodeId.set(node.event.nodeId, list)

    const state = sameTimeStates.get(node.eventTime)
    if (state === undefined) {
      sameTimeStates.set(node.eventTime, {
        count: 1,
        firstIngestedAt: node.event.ingestedAt,
        hasDistinctIngestionOrder: false,
      })
      continue
    }

    state.count += 1
    if (
      trackIngestionOrder &&
      !state.hasDistinctIngestionOrder &&
      state.firstIngestedAt !== undefined &&
      node.event.ingestedAt !== undefined &&
      node.event.ingestedAt !== state.firstIngestedAt
    ) {
      state.hasDistinctIngestionOrder = true
    } else if (
      trackIngestionOrder &&
      state.firstIngestedAt === undefined &&
      node.event.ingestedAt !== undefined
    ) {
      state.firstIngestedAt = node.event.ingestedAt
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
        pushEvidence(node, { type: "parent_event", parentEventId })
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
        pushEvidence(node, {
          type: "causal_dependency",
          dependsOnEventId: dependencyEventId,
        })
      }
    }
  }

  for (const [, sameNodeEvents] of nodesByNodeId) {
    sameNodeEvents.sort(compareSameNodeSequence)

    let previous: GraphNode<T> | undefined
    for (const current of sameNodeEvents) {
      if (current.event.sequence === undefined) {
        break
      }

      if (
        previous?.event.sequence !== undefined &&
        previous.event.sequence < current.event.sequence
      ) {
        if (pushUniqueEdge(previous, current.index)) {
          current.indegree += 1
        }
        pushEvidence(current, { type: "same_node_sequence" })
        current.hasSequenceEvidence = true
      }

      previous = current
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

  const ordered: OrderedEvent<T>[] = []
  const isOrdered = new Uint8Array(nodes.length)
  let orderedCount = 0
  while (queue.length > 0) {
    const current = popReadyNode(queue, options?.tieBreaker)
    if (current === undefined) {
      break
    }

    const sameTimeState = sameTimeStates.get(current.eventTime)
    ordered.push(buildOrderedMetadata(
      current,
      BigInt(orderedCount),
      options?.tieBreaker,
      sameTimeState?.count ?? 1,
      sameTimeState?.hasDistinctIngestionOrder ?? false,
    ))
    orderedCount += 1
    isOrdered[current.index] = 1

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

  if (orderedCount !== nodes.length && strict) {
    throw new Error("Unable to produce a complete ordering from the provided events")
  }

  const unresolvedNodes: GraphNode<T>[] = []
  for (const node of nodes) {
    if (isOrdered[node.index] === 0) {
      unresolvedNodes.push(node)
    }
  }
  unresolvedNodes.sort((a, b) => compareGraphNodes(a, b, options?.tieBreaker))

  for (const node of unresolvedNodes) {
    node.isUnresolved = true
    anomalies.push({
      type: "unknown_order",
      severity: options?.allowUnknownOrder === false ? "error" : "warning",
      event: node.event,
      message: "Event could not be fully placed by causal ordering and was appended deterministically",
    })
    const sameTimeState = sameTimeStates.get(node.eventTime)
    ordered.push(buildOrderedMetadata(
      node,
      BigInt(orderedCount),
      options?.tieBreaker,
      sameTimeState?.count ?? 1,
      sameTimeState?.hasDistinctIngestionOrder ?? false,
    ))
    orderedCount += 1
    isOrdered[node.index] = 1
  }

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

/**
 * Orders already-validated events through the public validated-event path.
 *
 * This public signature intentionally excludes the older repo-coordination
 * `internal` bag so the package does not preserve implementation plumbing as
 * long-term contract.
 */
export function orderValidatedEvents<T>(
  validEvents: ValidatedEventEnvelope<T>[],
  options?: OrderOptions<T>,
): OrderResult<T> {
  const validationOptions: { maxClockDriftMs?: bigint; includeWarnings?: boolean } = {
    includeWarnings: false,
  }
  if (options?.maxClockDriftMs !== undefined) {
    validationOptions.maxClockDriftMs = options.maxClockDriftMs
  }

  const detectAnomaliesEnabled = options?.detectAnomalies !== false
  const internalOptions: OrderValidatedEventsInternalOptions<T> = {
    sourceEvents: validEvents,
    invalidEvents: 0,
  }

  if (detectAnomaliesEnabled) {
    internalOptions.validations = createValidationRecordsForValidatedEvents(
      validEvents,
      validationOptions,
    )
    internalOptions.anomalies = []
  }

  return orderValidatedEventsCore(validEvents, options, internalOptions)
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
  const anomalies: EventAnomaly<T>[] = []
  const anomalyCollector = detectAnomaliesEnabled
    ? createAnomalyCollector<T>()
    : undefined

  const validEvents: ValidatedEventEnvelope<T>[] = []
  for (const event of events) {
    const validation = validateEvent(event, validationOptions) as ValidationResult<ValidatedEventEnvelope<T>>
    if (anomalyCollector !== undefined) {
      anomalyCollector.observe(event, validation)
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

  const internalOptions: OrderValidatedEventsInternalOptions<T> = {
    sourceEvents: events,
    anomalies: anomalyCollector?.anomalies ?? anomalies,
    invalidEvents: events.length - validEvents.length,
  }

  return orderValidatedEventsCore(validEvents, options, internalOptions)
}
