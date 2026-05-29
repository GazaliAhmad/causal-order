import type {
  AnomalyType,
  EventAnomaly,
  TranslationAnomaly,
  TranslationAnomalyCode,
  TranslationAnomalyStage,
  TranslationField,
  TranslationMapperName,
  TranslationOptionalFieldAction,
  TranslationRecordFailureAction,
} from "../types.js"

type EventAnomalySeverity = EventAnomaly["severity"]
type TranslationPolicyAction =
  | TranslationRecordFailureAction
  | TranslationOptionalFieldAction

export type EventAnomalySummary = {
  total: number
  byType: Partial<Record<AnomalyType, number>>
  bySeverity: Partial<Record<EventAnomalySeverity, number>>
}

export type TranslationAnomalySummary = {
  total: number
  byCode: Partial<Record<TranslationAnomalyCode, number>>
  byField: Partial<Record<TranslationField, number>>
  byMapper: Partial<Record<TranslationMapperName, number>>
  byStage: Partial<Record<TranslationAnomalyStage, number>>
  byPolicyAction: Partial<Record<TranslationPolicyAction, number>>
}

export function summarizeEventAnomalies<T>(
  anomalies: readonly EventAnomaly<T>[],
): EventAnomalySummary {
  const byType: Partial<Record<AnomalyType, number>> = {}
  const bySeverity: Partial<Record<EventAnomalySeverity, number>> = {}

  for (const anomaly of anomalies) {
    incrementCount(byType, anomaly.type)
    incrementCount(bySeverity, anomaly.severity)
  }

  return {
    total: anomalies.length,
    byType,
    bySeverity,
  }
}

export function summarizeTranslationAnomalies<TInput>(
  anomalies: readonly TranslationAnomaly<TInput>[],
): TranslationAnomalySummary {
  const byCode: Partial<Record<TranslationAnomalyCode, number>> = {}
  const byField: Partial<Record<TranslationField, number>> = {}
  const byMapper: Partial<Record<TranslationMapperName, number>> = {}
  const byStage: Partial<Record<TranslationAnomalyStage, number>> = {}
  const byPolicyAction: Partial<Record<TranslationPolicyAction, number>> = {}

  for (const anomaly of anomalies) {
    incrementCount(byCode, anomaly.code)
    incrementCount(byField, anomaly.field)
    incrementCount(byMapper, anomaly.mapper)
    incrementCount(byStage, anomaly.stage)
    incrementCount(byPolicyAction, anomaly.policy.action)
  }

  return {
    total: anomalies.length,
    byCode,
    byField,
    byMapper,
    byStage,
    byPolicyAction,
  }
}

function incrementCount<TKey extends string>(
  counts: Partial<Record<TKey, number>>,
  key: TKey,
) {
  counts[key] = (counts[key] ?? 0) + 1
}
