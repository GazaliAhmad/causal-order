import type {
  CorrectionNotice,
  EventAnomaly,
  OrderBatch,
  OrderResult,
  OrderedEvent,
  OrderStats,
  StreamAnomalyHorizon,
} from "../types.js"
import { explainOrderedEvent } from "./explainOrderedEvent.js"
import {
  summarizeEventAnomalies,
  type EventAnomalySummary,
} from "./summarizeAnomalies.js"

export type OrderedEventInspection<T = unknown> = {
  eventId: string
  nodeId: string
  orderIndex: bigint
  orderBasis: OrderedEvent<T>["orderBasis"]
  confidence: OrderedEvent<T>["confidence"]
  causalEvidenceCount: number
  summary: string
}

export type InspectedEventAnomaly<T = unknown> = {
  type: EventAnomaly<T>["type"]
  severity: EventAnomaly<T>["severity"]
  eventId?: string
  relatedEventIds: readonly string[]
  message: string
}

export type OrderedEventCounts<T = unknown> = {
  byOrderBasis: Partial<Record<OrderedEvent<T>["orderBasis"], number>>
  byConfidence: Partial<Record<OrderedEvent<T>["confidence"], number>>
}

export type OrderResultInspection<T = unknown> = {
  stats: OrderStats
  counts: OrderedEventCounts<T>
  anomalySummary: EventAnomalySummary
  ordered: OrderedEventInspection<T>[]
  anomalies: InspectedEventAnomaly<T>[]
}

export type OrderBatchInspection<T = unknown> = {
  watermark: bigint
  isFinal: boolean
  anomalyHorizon: StreamAnomalyHorizon
  correction?: CorrectionNotice
  counts: OrderedEventCounts<T>
  anomalySummary: EventAnomalySummary
  events: OrderedEventInspection<T>[]
  anomalies: InspectedEventAnomaly<T>[]
}

export function inspectOrderResult<T>(
  result: Readonly<OrderResult<T>>,
): OrderResultInspection<T> {
  const ordered = inspectOrderedEvents(result.ordered)

  return {
    stats: result.stats,
    counts: ordered.counts,
    anomalySummary: summarizeEventAnomalies(result.anomalies),
    ordered: ordered.events,
    anomalies: inspectEventAnomalies(result.anomalies),
  }
}

export function inspectOrderBatch<T>(
  batch: Readonly<OrderBatch<T>>,
): OrderBatchInspection<T> {
  const ordered = inspectOrderedEvents(batch.events)

  return {
    watermark: batch.watermark,
    isFinal: batch.isFinal,
    anomalyHorizon: batch.anomalyHorizon,
    ...(batch.correction === undefined ? {} : { correction: batch.correction }),
    counts: ordered.counts,
    anomalySummary: summarizeEventAnomalies(batch.anomalies),
    events: ordered.events,
    anomalies: inspectEventAnomalies(batch.anomalies),
  }
}

function inspectOrderedEvents<T>(orderedEvents: readonly OrderedEvent<T>[]) {
  const byOrderBasis: Partial<Record<OrderedEvent<T>["orderBasis"], number>> = {}
  const byConfidence: Partial<Record<OrderedEvent<T>["confidence"], number>> = {}

  const events = orderedEvents.map((orderedEvent) => {
    byOrderBasis[orderedEvent.orderBasis] =
      (byOrderBasis[orderedEvent.orderBasis] ?? 0) + 1
    byConfidence[orderedEvent.confidence] =
      (byConfidence[orderedEvent.confidence] ?? 0) + 1

    const explanation = explainOrderedEvent(orderedEvent)

    return {
      eventId: explanation.eventId,
      nodeId: explanation.nodeId,
      orderIndex: explanation.orderIndex,
      orderBasis: explanation.orderBasis,
      confidence: explanation.confidence,
      causalEvidenceCount: explanation.causalEvidence.length,
      summary: explanation.summary,
    }
  })

  return {
    events,
    counts: {
      byOrderBasis,
      byConfidence,
    },
  }
}

function inspectEventAnomalies<T>(anomalies: readonly EventAnomaly<T>[]) {
  return anomalies.map((anomaly) => {
    const eventId = anomaly.event?.id

    return {
      type: anomaly.type,
      severity: anomaly.severity,
      ...(eventId === undefined ? {} : { eventId }),
      relatedEventIds: anomaly.relatedEvents?.map((event) => event.id) ?? [],
      message: anomaly.message,
    }
  })
}
