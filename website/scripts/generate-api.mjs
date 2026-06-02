import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(websiteRoot, "..");
const generatedDir = path.join(websiteRoot, "src", "generated");
const generatedPath = path.join(generatedDir, "api.json");

const repoPackage = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);

const repoUrl = normalizeRepoUrl(
  repoPackage.repository?.url ?? repoPackage.repository,
);
const sourceBaseUrl = `${repoUrl}/blob/main`;

const fileCache = new Map();
const apiGroupDefinitions = [
  { title: "Clocks", prefix: "src/clock/" },
  { title: "Comparison", prefix: "src/compare/" },
  { title: "Translation", prefix: "src/translate/" },
  { title: "Validation", prefix: "src/validate/" },
  { title: "Anomalies", prefix: "src/anomalies/" },
  { title: "Inspection", prefix: "src/inspect/" },
  { title: "Ordering", prefix: "src/order/" },
];
const subpathDescriptions = {
  ".": "Full top-level surface for users who prefer one import path.",
  "./types": "Type-only entrypoint for the published public type surface.",
  "./clock": "Clock helpers for creating, parsing, and serializing HLC values.",
  "./compare": "Pairwise comparison helpers for HLC and causal reasoning, centered on the current primary names rather than deprecated compatibility aliases.",
  "./validate": "Validation helpers for clocks and event envelopes.",
  "./anomalies": "Structured anomaly detection and anomaly-facing runtime types.",
  "./inspect": "Operational inspection helpers for summaries, explanations, and compact result snapshots.",
  "./order": "Combined ordering barrel for users who want batch, stream, tie-breakers, and watermarks together.",
  "./batch": "Bounded batch ordering plus current tie-breaker helpers, without the deprecated compatibility alias kept at the root import.",
  "./stream": "Streaming ordering surface through orderEventStream().",
  "./watermarks": "Watermark helpers only.",
  "./translate": "Raw-record translation surface, including translateBatch() and TranslateBatchPolicyError.",
};
const exportDescriptions = {
  HlcClock: "Monotonic hybrid logical clock interface for local send and remote merge operations.",
  createHlcClock: "Creates a monotonic hybrid logical clock for a single node.",
  parseHlc: "Parses a serialized HLC string into its structured parts.",
  serializeHlc: "Serializes an HLC value into the canonical string form.",
  compareByHlc: "Compares two events by their HLC values only.",
  compareClocks: "Compares two validated HLC timestamps directly.",
  compareByCausality: "Performs pairwise causal comparison without inventing evidence.",
  compareValidatedByCausality: "Performs pairwise causal comparison on already validated events.",
  applyTieBreaker: "Applies the active deterministic tie-breaker when stronger ordering is absent.",
  compareDeterministically: "Deterministically compares two events when causal proof is insufficient.",
  compareValidatedDeterministically:
    "Deterministically compares two already validated events using the current tie-breaker.",
  validateClock: "Validates an HLC clock value and reports structured failures or warnings.",
  validateEvent: "Validates an event envelope and returns a branded validated value on success.",
  translateBatch:
    "Translates raw user-space records into event envelopes and structured translation anomalies.",
  TranslateBatchPolicyError:
    "Error raised when translateBatch() policy configuration chooses fail-fast handling for a structured translation anomaly.",
  detectSingleEventAnomalies: "Detects anomalies that can be inferred from one event in isolation.",
  detectAnomalies: "Detects structured anomalies across a bounded event set.",
  summarizeEventAnomalies:
    "Summarizes emitted event anomalies by type and severity for operator-facing inspection.",
  summarizeTranslationAnomalies:
    "Summarizes translation anomalies by code, field, mapper, stage, and policy action.",
  explainOrderedEvent:
    "Builds a compact human-readable explanation of why one ordered event landed where it did.",
  inspectOrderResult:
    "Builds a payload-agnostic inspection snapshot for a bounded orderEvents() result.",
  inspectOrderBatch:
    "Builds a payload-agnostic inspection snapshot for one emitted orderEventStream() batch.",
  DEFAULT_TIE_BREAKER: "Default deterministic tie-breaker used when stronger ordering is unavailable.",
  getTieBreaker: "Resolves the tie-breaker function from the current ordering options.",
  compareWithTieBreaker: "Compares two events with the configured deterministic tie-breaker.",
  orderValidatedEvents: "Orders already validated events without re-running validation.",
  orderEvents: "Orders a bounded event set and returns ordered output, anomalies, and stats.",
  orderEventStream:
    "Consumes an async event source and emits watermark-aware ordered batches.",
  eventTimeWatermark: "Advances stream readiness from event-time timestamps.",
  ingestedAtWatermark: "Advances stream readiness from ingestion-time metadata.",
  createProcessingTimeWatermark:
    "Builds a processing-time watermark helper for more aggressive stream progress.",
};
const pageEnhancements = {
  compareByHlc: {
    summary:
      "Use this when you want a direct HLC-to-HLC comparison without inferring broader causal semantics.",
    usage: `import { compareByHlc } from "causal-order"

const relation = compareByHlc(eventA.clock, eventB.clock)

console.log(relation)`,
    bullets: [
      "Use this when you want direct HLC comparison without broader causal inference.",
      "Possible results are <code>before</code>, <code>after</code>, <code>equal</code>, and <code>unknown</code> for invalid input.",
    ],
  },
  translateBatch: {
    primary: true,
    summary:
      "This is the raw-record ingress entry point. It maps arbitrary user-space records into the event envelope, applies the published timestamp coercion rules, and separates accepted envelopes from structured translation anomalies.",
    usage: `import { orderEvents, translateBatch } from "causal-order"

const translated = translateBatch(records, {
  getEventId: (record) => record.eventId,
  getNodeId: (record) => record.source,
  getPhysicalTime: (record) => record.occurredAt,
  getSequence: (record) => record.sequence,
  getParentEventId: (record) => record.parent,
  getPayload: (record) => record.body,
})

const ordered = orderEvents(translated.translated, {
  strict: false,
  detectAnomalies: true,
})

console.log(translated.anomalies)
console.log(ordered.ordered)`,
    bullets: [
      "<code>translated</code>: readonly translated event envelopes ready for ordering.",
      "<code>anomalies</code>: structured translation failures with field, mapper, stage, and actual-value metadata.",
      "<code>getEventId</code>, <code>getNodeId</code>, and <code>getPhysicalTime</code> are required mappers.",
      "Timestamps accept <code>bigint</code>, safe integer <code>number</code>, and canonical integer <code>string</code>.",
      "<code>Date</code>, ISO timestamp strings, decimals, exponent notation, and unsafe integers are rejected deterministically.",
      "The returned envelope shell is shallowly frozen, while <code>payload</code> remains by reference.",
    ],
  },
  TranslateBatchPolicyError: {
    summary:
      "This exported error class is raised when <code>translateBatch()</code> policy configuration chooses fail-fast handling for a structured translation anomaly.",
    usage: `import { TranslateBatchPolicyError, translateBatch } from "causal-order/translate"

try {
  translateBatch(records, {
    getEventId: (record) => record.eventId,
    getNodeId: (record) => record.nodeId,
    getPhysicalTime: (record) => record.occurredAt,
    policy: {
      recordFailure: "fail",
      optionalFieldFailure: "warn",
    },
  })
} catch (error) {
  if (error instanceof TranslateBatchPolicyError) {
    console.error(error.anomaly)
  }
}`,
    bullets: [
      "Extends <code>Error</code> and carries the triggering structured <code>anomaly</code>.",
      "Raised only when the configured translation policy chooses <code>fail</code> for the encountered anomaly class.",
      "Available from both <code>causal-order</code> and the narrower <code>causal-order/translate</code> entrypoint.",
    ],
  },
  orderEvents: {
    primary: true,
    summary:
      "This is the main bounded-batch entry point. It validates input, builds ordering constraints from supported causal evidence, and emits a deterministic result even when full proof is not available.",
    usage: `import { orderEvents } from "causal-order"

const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
  tieBreaker: "event_id",
})

console.log(result.ordered)
console.log(result.anomalies)
console.log(result.stats)`,
    bullets: [
      "<code>ordered</code>: ordered events with <code>orderIndex</code>, <code>orderBasis</code>, and <code>confidence</code>.",
      "<code>anomalies</code>: invalid, suspicious, or operationally important records.",
      "<code>stats</code>: counts for total, valid, invalid, ordered, and anomaly totals.",
      "<code>tieBreaker</code>: deterministic tie breaker such as <code>event_id</code> or <code>ingestion_order</code>.",
      "<code>strict</code>: throw on invalid or unresolved conditions instead of returning a tolerant result.",
      "<code>detectAnomalies</code>: include anomaly detection in the returned batch result.",
      "<code>allowUnknownOrder</code>: permit unresolved ordering to remain explicit in non-strict mode.",
      "<code>maxClockDriftMs</code>: validation bound for future clock drift checks.",
    ],
  },
  orderEventStream: {
    primary: true,
    summary:
      "This is the streaming entry point for watermark-aware ordering with explicit late-arrival and correction behavior.",
    usage: `import { orderEventStream } from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 100,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "flag",
  strict: false,
})) {
  console.log(batch.events)
  console.log(batch.anomalies)
  console.log(batch.watermark, batch.isFinal)
}`,
    bullets: [
      "Consumes an async iterable of event envelopes.",
      "Emits watermark-aware ordered batches.",
      "Supports explicit late-arrival policies and correction-capable output.",
    ],
  },
  validateEvent: {
    primary: true,
    summary:
      "Use this when you need to validate event-envelope input directly before ordering or other downstream processing.",
    usage: `import { validateEvent } from "causal-order"

const validation = validateEvent(event, {
  includeWarnings: true,
})

if (!validation.valid) {
  console.error(validation.errors)
} else {
  console.log(validation.value)
  console.log(validation.warnings)
}`,
    bullets: [
      "<code>valid: true</code> returns a branded <code>value</code> plus any warnings.",
      "<code>valid: false</code> returns structured <code>errors</code> and <code>warnings</code>.",
      "<code>event.id</code> must be a non-empty string.",
      "<code>event.nodeId</code> must be a non-empty string.",
      "<code>event.clock</code> must pass HLC validation.",
      "<code>event.sequence</code>, when present, must be a non-negative <code>bigint</code>.",
    ],
  },
  compareByCausality: {
    primary: true,
    summary:
      "Use this for pairwise causal comparison when you need a relation answer without emitting a full ordered batch.",
    usage: `import { compareByCausality } from "causal-order"

const relation = compareByCausality(eventA, eventB)

if (relation === "before") {
  console.log("A is before B")
} else if (relation === "unknown") {
  console.log("The library cannot justify the pairwise relationship")
}`,
    bullets: [
      "Possible results are <code>before</code>, <code>after</code>, <code>equal</code>, and <code>unknown</code>.",
      "The current exported pairwise contract does not promote unsupported cross-node cases into a first-class <code>concurrent</code> result.",
      "Supported evidence includes <code>parentEventId</code>, <code>dependencyEventIds</code>, and same-node monotonic <code>sequence</code>.",
    ],
  },
  compareDeterministically: {
    summary:
      "Use this when stronger causal proof is unavailable but you still need deterministic fallback ordering over event envelopes.",
    usage: `import { compareDeterministically } from "causal-order"

const result = compareDeterministically(eventA, eventB, "event_id")

console.log(result)`,
    bullets: [
      "Use this when stronger causal proof is unavailable but you still need stable fallback ordering.",
      "The return value is a comparator-style number suitable for deterministic ordering decisions.",
    ],
  },
  inspectOrderResult: {
    primary: true,
    summary:
      "Use this when you want a compact operational snapshot of one bounded <code>orderEvents()</code> result without writing custom result-shaping code first.",
    usage: `import { inspectOrderResult, orderEvents } from "causal-order"

const result = orderEvents(events, {
  strict: false,
  detectAnomalies: true,
})

const inspection = inspectOrderResult(result)

console.log(inspection.stats)
console.log(inspection.anomalySummary)
console.log(inspection.ordered)`,
    bullets: [
      "Summarizes ordered-event counts by <code>orderBasis</code> and <code>confidence</code>.",
      "Produces an anomaly summary without hiding the original <code>result.anomalies</code> array.",
      "Keeps the output payload-agnostic so it works as a lightweight operator-facing snapshot.",
    ],
  },
  inspectOrderBatch: {
    primary: true,
    summary:
      "Use this when you want the same compact inspection layer for one emitted <code>orderEventStream()</code> batch, including watermark and correction metadata.",
    usage: `import { inspectOrderBatch, orderEventStream } from "causal-order"

for await (const batch of orderEventStream(source(), {
  batchSize: 100,
  maxLateArrivalMs: 30_000n,
  lateArrivalPolicy: "emit_correction",
  strict: false,
})) {
  const inspection = inspectOrderBatch(batch)

  console.log(inspection.watermark)
  console.log(inspection.correction)
  console.log(inspection.anomalySummary)
}`,
    bullets: [
      "Preserves emitted <code>watermark</code>, <code>isFinal</code>, and correction metadata in the inspection output.",
      "Summarizes emitted events by <code>orderBasis</code> and <code>confidence</code>.",
      "Helps operators inspect correction-capable stream output without flattening the underlying batch contract.",
    ],
  },
  orderValidatedEvents: {
    summary:
      "Use this when you already hold validated events and want the public ordering step without re-running validation.",
    signatures: [
      `function orderValidatedEvents<T>(
  validEvents: ValidatedEventEnvelope<T>[],
  options?: OrderOptions<T>,
): OrderResult<T>`,
    ],
    bullets: [
      "This page shows the supported call shape for already validated events.",
      "Use <code>orderEvents()</code> instead when you want validation included in the same step.",
    ],
  },
};
const deprecatedPages = {
  compareClocks: {
    since: "0.5.0",
    replacementName: "compareByHlc",
    replacementLabel: "compareByHlc()",
    message:
      "This deprecated root-only compatibility alias remains through 0.9.x for older code, but new code should prefer the explicit HLC-specific helper before it disappears at 1.0.0.",
  },
  compareWithTieBreaker: {
    since: "0.5.0",
    replacementName: "compareDeterministically",
    replacementLabel: "compareDeterministically()",
    message:
      "This compatibility alias remains exported for older code, but new code should prefer the primary deterministic fallback helper.",
  },
};
const typeDescriptions = {
  NodeId: "Branded node identifier used to separate same-node and cross-node reasoning.",
  EventId: "Branded event identifier used for duplicate and reference checks.",
  HlcTimestamp: "Serialized hybrid logical clock string.",
  ValidatedHlcTimestamp: "Branded HLC timestamp that has passed validation.",
  EventEnvelope: "Public shape for an input event and its ordering metadata.",
  TranslatedEventEnvelope:
    "Readonly translated event-envelope shape returned by the raw-record ingress layer.",
  ValidatedEventEnvelope: "Validated event envelope safe for downstream ordering logic.",
  TranslateMapper: "Synchronous mapper shape used by translateBatch() field extractors.",
  TranslateTimestampInput:
    "Accepted raw timestamp input for translation: bigint, safe integer number, canonical integer string, or Date for explicit rejection handling.",
  TranslateBatchConfig:
    "Mapper configuration for translating raw records into event envelopes.",
  TranslateBatchPolicy:
    "Policy configuration controlling how translation failures are surfaced or failed.",
  TranslationAnomalyCode: "Stable code describing a translation-time mapping or coercion failure.",
  TranslationAnomalyDomain: "Stable top-level domain for translation anomaly classification.",
  TranslationAnomalyFamily: "Stable family split between mapping and structural translation failures.",
  TranslationAnomalyCategory: "Stable category used for machine-readable translation anomaly handling.",
  TranslationRecordFailureAction: "Fail-fast or warning action for record-level translation failures.",
  TranslationOptionalFieldAction:
    "Handling action for optional-field translation failures, including continue behavior where omission is honest.",
  TranslationPolicyKey: "Stable policy selector describing the translation failure class being handled.",
  TranslationPolicyDecision: "Resolved policy decision attached to structured translation anomalies.",
  TranslationField: "Stable field label used in structured translation anomalies.",
  TranslationMapperName: "Stable mapper-function label used in structured translation anomalies.",
  TranslationAnomalyStage: "Translation pipeline stage where a structured anomaly was raised.",
  TranslationActualValueType:
    "Normalized runtime value classification attached to translation anomalies.",
  TranslationDiagnosticSource: "Stable source split between mapping and structural translation failures.",
  TranslationDiagnosticRecord: "Record-local translation diagnostic context including index and original input.",
  TranslationDiagnosticOrdering:
    "Deterministic ordering metadata attached to emitted translation anomalies.",
  TranslationFieldReferenceKind: "Stable field-reference kind used by translation diagnostics.",
  TranslationFieldReference: "Machine-readable field reference attached to translation diagnostics.",
  TranslationAnomalyClassification:
    "Stable machine-readable classification attached to translation anomalies.",
  TranslationDiagnosticLocation: "Structured field and mapper location metadata for translation diagnostics.",
  TranslationDiagnosticContract: "Contract-facing detail attached to translation diagnostics.",
  TranslationDiagnostic: "Nested machine-readable diagnostic object attached to translation anomalies.",
  TranslationAnomaly:
    "Structured translation failure record carrying mapper, field, stage, and actual-value metadata.",
  TranslateBatchResult:
    "Top-level translation result containing accepted envelopes and structured anomalies.",
  CausalOrdering: "Pairwise ordering result such as before, after, equal, or unknown.",
  CausalEvidence: "Machine-readable evidence explaining why one event was ordered relative to another.",
  ValidationErrorCode: "Stable code describing a validation failure category.",
  ValidationWarningCode: "Stable code describing a non-fatal validation warning.",
  ValidationError: "Structured validation failure entry.",
  ValidationWarning: "Structured non-fatal validation warning entry.",
  ValidationSuccess: "Successful validation wrapper carrying the validated value.",
  ValidationFailure: "Failed validation wrapper carrying errors and warnings.",
  ValidationResult: "Discriminated union returned by validation helpers.",
  AnomalyType: "Stable anomaly category emitted by ordering and analysis helpers.",
  EventAnomaly: "Structured anomaly record tied to one or more events.",
  OrderedEvent: "Ordered event entry with confidence, basis, and optional causal evidence.",
  OrderedEventExplanation:
    "Compact explanation payload describing why an ordered event landed where it did.",
  OrderedEventInspection:
    "Compact event-level inspection snapshot derived from an ordered result entry.",
  InspectedEventAnomaly:
    "Compact anomaly view used by inspection helpers for operator-facing output.",
  OrderedEventCounts:
    "Grouped inspection counts by order basis and confidence level.",
  OrderResultInspection:
    "Payload-agnostic inspection snapshot returned by inspectOrderResult().",
  OrderBatchInspection:
    "Payload-agnostic inspection snapshot returned by inspectOrderBatch().",
  EventAnomalySummary: "Grouped event-anomaly totals by type and severity.",
  TranslationAnomalySummary:
    "Grouped translation-anomaly totals by code, field, mapper, stage, and policy action.",
  OrderStats: "Summary counts describing the outcome of a bounded ordering run.",
  OrderResult: "Top-level bounded ordering result containing ordered events, anomalies, and stats.",
  TieBreaker: "Deterministic comparison function used when stronger ordering is absent.",
  OrderOptions: "Options controlling bounded ordering behavior and anomaly handling.",
  PolicyVisibilityKind: "Draft audit-output category for future extension-policy decisions.",
  PolicyVisibilityRecord:
    "Draft operator-visible audit record describing what an extension policy did without mutating payloads silently.",
  ExtensionPolicyAction: "Draft contradiction-policy action shared across payload-agnostic extension hooks.",
  CausalContradictionCandidate:
    "Draft payload-agnostic contradiction candidate for future policy hooks.",
  CausalContradictionPolicyResult:
    "Draft result shape for contradiction-policy evaluation with explicit operator visibility.",
  CausalContradictionPolicy:
    "Draft policy interface for contradiction handling outside the core payload contract.",
  EntityForkCandidate:
    "Draft payload-agnostic entity-fork candidate supplied by higher-layer identity logic.",
  ForkResolutionAction: "Draft fork-policy action set that avoids implicit payload merging.",
  ForkResolutionPolicyResult:
    "Draft result shape for fork-resolution decisions with explicit visibility output.",
  ForkResolutionPolicy:
    "Draft policy interface for entity-fork handling outside the core payload contract.",
  SemanticDedupeCandidate:
    "Draft semantic-dedupe candidate for future policy hooks across different identifiers.",
  SemanticDedupeAction:
    "Draft dedupe-policy action set that preserves explicit operator-facing visibility.",
  SemanticDedupePolicyResult:
    "Draft result shape for semantic-dedupe decisions including retained and suppressed IDs.",
  SemanticDedupePolicy:
    "Draft policy interface for semantic dedupe without forcing payload-aware merge logic into the core.",
  CorrectionScope: "Indicates whether a stream correction is local to a batch or broader in scope.",
  CorrectionNotice: "Structured notice attached to correction-capable stream batches.",
  StreamAnomalyHorizon: "Anomaly carry model for stream windows and emitted history.",
  LateArrivalPolicy: "Policy controlling how late stream events are surfaced or rejected.",
  WatermarkSignal: "Structured watermark progress signal returned by watermark helpers.",
  WatermarkFunction: "Function shape used to derive stream watermark progress.",
  StreamOrderOptions: "Options controlling streaming ordering, watermarking, and correction behavior.",
  StreamOrderBatch: "Structured batch emitted by streaming ordering.",
};

const exportedModules = [...collectExportedModules("src/index.ts")]
  .filter((sourcePath) => sourcePath !== "src/index.ts");
const exportsByPath = new Map(
  exportedModules.map((sourcePath) => [sourcePath, extractExports(readSource(sourcePath))]),
);
const publicFunctions = collectPublicFunctions();
const publicTypes = collectPublicTypes();
const apiFunctionPages = buildApiFunctionPages();
const navigationItems = buildNavigationItems(apiFunctionPages);
const apiPages = {
  ...apiFunctionPages,
  types: {
    title: "Types",
    description: "The main public types exported by causal-order.",
    sourcePath: "src/types.ts",
    signatures: [],
    href: "/api/types/",
    sourceUrl: toSourceUrl("src/types.ts"),
  },
};

const overviewGroups = [
  ...buildOverviewGroups(),
];

const types = {
  groups: [
    {
      title: "Core event types",
      items: [
        typeItem("NodeId"),
        typeItem("EventId"),
        typeItem("HlcTimestamp"),
        typeItem("ValidatedHlcTimestamp"),
        typeItem("EventEnvelope", "EventEnvelope<T = unknown>"),
        typeItem("ValidatedEventEnvelope", "ValidatedEventEnvelope<T = unknown>"),
        typeItem("CausalOrdering"),
        typeItem("CausalEvidence"),
      ],
    },
    {
      title: "Translation types",
      items: [
        typeItem("TranslatedEventEnvelope", "TranslatedEventEnvelope<T = unknown>"),
        typeItem("TranslateMapper", "TranslateMapper<TInput, TValue>"),
        typeItem("TranslateTimestampInput"),
        typeItem("TranslateBatchConfig", "TranslateBatchConfig<TInput, TPayload = TInput>"),
        typeItem("TranslateBatchPolicy"),
        typeItem("TranslationAnomalyCode"),
        typeItem("TranslationAnomalyDomain"),
        typeItem("TranslationAnomalyFamily"),
        typeItem("TranslationAnomalyCategory"),
        typeItem("TranslationRecordFailureAction"),
        typeItem("TranslationOptionalFieldAction"),
        typeItem("TranslationPolicyKey"),
        typeItem("TranslationPolicyDecision"),
        typeItem("TranslationField"),
        typeItem("TranslationMapperName"),
        typeItem("TranslationAnomalyStage"),
        typeItem("TranslationActualValueType"),
        typeItem("TranslationDiagnosticSource"),
        typeItem("TranslationDiagnosticRecord", "TranslationDiagnosticRecord<TInput = unknown>"),
        typeItem("TranslationDiagnosticOrdering"),
        typeItem("TranslationFieldReferenceKind"),
        typeItem("TranslationFieldReference"),
        typeItem("TranslationAnomalyClassification"),
        typeItem("TranslationDiagnosticLocation"),
        typeItem("TranslationDiagnosticContract"),
        typeItem("TranslationDiagnostic", "TranslationDiagnostic<TInput = unknown>"),
        typeItem("TranslationAnomaly", "TranslationAnomaly<TInput = unknown>"),
        typeItem("TranslateBatchResult", "TranslateBatchResult<TPayload = unknown, TInput = unknown>"),
      ],
    },
    {
      title: "Validation and anomaly types",
      items: [
        typeItem("ValidationErrorCode"),
        typeItem("ValidationWarningCode"),
        typeItem("ValidationError"),
        typeItem("ValidationWarning"),
        typeItem("ValidationSuccess", "ValidationSuccess<TValue>"),
        typeItem("ValidationFailure"),
        typeItem("ValidationResult", "ValidationResult<TValue = never>"),
        typeItem("AnomalyType"),
        typeItem("EventAnomaly", "EventAnomaly<T = unknown>"),
      ],
    },
    {
      title: "Ordering result types",
      items: [
        typeItem("OrderedEvent", "OrderedEvent<T = unknown>"),
        typeItem("OrderStats"),
        typeItem("OrderResult", "OrderResult<T = unknown>"),
        typeItem("TieBreaker", "TieBreaker<T>"),
        typeItem("OrderOptions", "OrderOptions<T>"),
      ],
    },
    {
      title: "Inspection types",
      items: [
        typeItem("OrderedEventExplanation", "OrderedEventExplanation<T = unknown>"),
        typeItem("OrderedEventInspection", "OrderedEventInspection<T = unknown>"),
        typeItem("InspectedEventAnomaly", "InspectedEventAnomaly<T = unknown>"),
        typeItem("OrderedEventCounts", "OrderedEventCounts<T = unknown>"),
        typeItem("OrderResultInspection", "OrderResultInspection<T = unknown>"),
        typeItem("OrderBatchInspection", "OrderBatchInspection<T = unknown>"),
        typeItem("EventAnomalySummary"),
        typeItem("TranslationAnomalySummary"),
      ],
    },
    {
      title: "Extension-policy draft types",
      items: [
        typeItem("PolicyVisibilityKind"),
        typeItem("PolicyVisibilityRecord"),
        typeItem("ExtensionPolicyAction"),
        typeItem("CausalContradictionCandidate", "CausalContradictionCandidate<T = unknown>"),
        typeItem("CausalContradictionPolicyResult"),
        typeItem("CausalContradictionPolicy", "CausalContradictionPolicy<T = unknown, TContext = unknown>"),
        typeItem("EntityForkCandidate", "EntityForkCandidate<T = unknown, TIdentity = unknown>"),
        typeItem("ForkResolutionAction"),
        typeItem("ForkResolutionPolicyResult"),
        typeItem("ForkResolutionPolicy", "ForkResolutionPolicy<T = unknown, TIdentity = unknown, TContext = unknown>"),
        typeItem("SemanticDedupeCandidate", "SemanticDedupeCandidate<T = unknown>"),
        typeItem("SemanticDedupeAction"),
        typeItem("SemanticDedupePolicyResult"),
        typeItem("SemanticDedupePolicy", "SemanticDedupePolicy<T = unknown, TContext = unknown>"),
      ],
    },
    {
      title: "Streaming types",
      items: [
        typeItem("CorrectionScope"),
        typeItem("CorrectionNotice"),
        typeItem("StreamAnomalyHorizon"),
        typeItem("LateArrivalPolicy"),
        typeItem("WatermarkSignal"),
        typeItem("WatermarkFunction", "WatermarkFunction<T>"),
        typeItem("StreamOrderOptions", "StreamOrderOptions<T>"),
        typeItem("StreamOrderBatch", "StreamOrderBatch<T = unknown>"),
      ],
    },
  ],
  confidenceModel: ["proven", "derived", "fallback", "unknown"],
};

const apiData = {
  repoUrl,
  sourceBaseUrl,
  navigation: navigationItems,
  overview: {
    title: "API Overview",
    description:
      "Public entry points for translation, validation, ordering, streaming, inspection, and the supporting type surface.",
    sourcePath: "src/index.ts",
    sourceUrl: toSourceUrl("src/index.ts"),
    focusedEntrypoints: buildFocusedEntrypoints(),
  },
  exportsByGroup: overviewGroups,
  pages: apiPages,
  types,
};

fs.mkdirSync(generatedDir, { recursive: true });
fs.writeFileSync(generatedPath, `${JSON.stringify(apiData, null, 2)}\n`, "utf8");

function normalizeRepoUrl(repository) {
  if (typeof repository !== "string") {
    return "https://github.com/GazaliAhmad/causal-order";
  }

  return repository
    .replace(/^git\+/, "")
    .replace(/\.git$/, "");
}

function readSource(relativePath) {
  const normalizedPath = relativePath.replaceAll("/", path.sep);
  const cached = fileCache.get(normalizedPath);
  if (cached !== undefined) {
    return cached;
  }

  const source = fs.readFileSync(path.join(repoRoot, normalizedPath), "utf8");
  fileCache.set(normalizedPath, source);
  return source;
}

function collectExportedModules(entryPath, visited = new Set()) {
  const normalizedEntryPath = normalizeSourcePath(entryPath);
  if (visited.has(normalizedEntryPath)) {
    return visited;
  }

  visited.add(normalizedEntryPath);

  for (const specifier of extractReExportSpecifiers(readSource(normalizedEntryPath))) {
    const sourcePath = resolveReExportSourcePath(normalizedEntryPath, specifier);
    collectExportedModules(sourcePath, visited);
  }

  return visited;
}

function extractReExportSpecifiers(source) {
  return Array.from(
    source.matchAll(/^export\s+(?:\*|{[^}]+})\s+from\s+"(.+?)"/gm),
    ([, specifier]) => specifier,
  );
}

function resolveReExportSourcePath(fromSourcePath, specifier) {
  const fromDir = path.posix.dirname(normalizeSourcePath(fromSourcePath));
  const tsSpecifier = specifier.endsWith(".js")
    ? specifier.replace(/\.js$/, ".ts")
    : specifier.endsWith(".ts")
      ? specifier
      : `${specifier}.ts`;

  return normalizeSourcePath(path.posix.join(fromDir, tsSpecifier));
}

function normalizeSourcePath(sourcePath) {
  return sourcePath.replaceAll("\\", "/");
}

function extractExports(source) {
  const functions = new Set(
    Array.from(
      source.matchAll(/^export\s+(?:async\s+)?function(?:\*)?\s+(\w+)/gm),
      ([, name]) => name,
    ),
  );
  const consts = new Set(
    Array.from(source.matchAll(/^export const (\w+)/gm), ([, name]) => name),
  );
  const classes = new Set(
    Array.from(source.matchAll(/^export class (\w+)/gm), ([, name]) => name),
  );
  const types = new Set([
    ...Array.from(source.matchAll(/^export type (\w+)/gm), ([, name]) => name),
    ...Array.from(source.matchAll(/^export interface (\w+)/gm), ([, name]) => name),
  ]);

  return { functions, consts, classes, types };
}

function extractFunctionDeclarations(source, name, count) {
  return extractAllFunctionDeclarations(source, name).slice(0, count);
}

function extractAllFunctionDeclarations(source, name) {
  const lines = source.split(/\r?\n/);
  const declarations = [];
  const declarationPattern = new RegExp(
    `^export\\s+(?:async\\s+)?function(?:\\*)?\\s+${name}(?:<|\\s*\\()`,
  );

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || !declarationPattern.test(line)) {
      continue;
    }

    const collected = [];
    let parenBalance = 0;
    let returnTypeSeen = false;

    for (let cursor = index; cursor < lines.length; cursor += 1) {
      const currentLine = lines[cursor];
      if (currentLine === undefined) {
        break;
      }

      collected.push(currentLine);
      parenBalance += countMatches(currentLine, "(") - countMatches(currentLine, ")");

      if (parenBalance <= 0 && /\)\s*:/.test(currentLine)) {
        returnTypeSeen = true;
      }

      if (parenBalance <= 0 && /\{\s*$/.test(currentLine)) {
        break;
      }

      if (returnTypeSeen) {
        break;
      }
    }

    declarations.push(
      collected
        .join("\n")
        .replace(/^export\s+/, "")
        .replace(/\s*\{\s*$/, "")
        .trim(),
    );
  }

  if (declarations.length === 0) {
    throw new Error(`Expected at least one declaration for ${name}, found 0`);
  }

  return declarations;
}

function countMatches(value, token) {
  return Array.from(value).filter((character) => character === token).length;
}

function extractAllClassDeclarations(source, name) {
  const lines = source.split(/\r?\n/);
  const declarations = [];
  const declarationPattern = new RegExp(`^export\\s+class\\s+${name}(?:<|\\s|\\{)`);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined || !declarationPattern.test(line)) {
      continue;
    }

    declarations.push(
      line
        .replace(/^export\s+/, "")
        .replace(/\s*\{\s*$/, "")
        .trim(),
    );
  }

  if (declarations.length === 0) {
    throw new Error(`Expected at least one class declaration for ${name}, found 0`);
  }

  return declarations;
}

function symbolItem(name, sourcePath, options = {}) {
  const { kind = "function" } = options;
  const exports = exportsByPath.get(sourcePath);
  if (exports === undefined) {
    throw new Error(`Missing exports for ${sourcePath}`);
  }

  const exportSet = kind === "type"
    ? exports.types
    : kind === "const"
      ? exports.consts
      : kind === "class"
        ? exports.classes
        : exports.functions;
  if (!exportSet.has(name)) {
    throw new Error(`Expected ${name} in ${sourcePath}`);
  }

  return {
    name,
    kind,
    label: kind === "function" ? `${name}()` : name,
    description: exportDescriptions[name] ?? "",
    deprecated: deprecatedPages[name] ?? null,
    sourcePath,
    sourceUrl: toSourceUrl(sourcePath),
  };
}

function typeItem(name, label = name) {
  const sourcePath = publicTypes.get(name);
  if (sourcePath === undefined) {
    throw new Error(`Expected exported type ${name} in the public API surface`);
  }

  return {
    name,
    label,
    description: typeDescriptions[name] ?? "",
    sourcePath,
    sourceUrl: toSourceUrl(sourcePath),
  };
}

function toSourceUrl(sourcePath) {
  return `${sourceBaseUrl}/${sourcePath.replaceAll(path.sep, "/")}`;
}

function collectPublicFunctions() {
  const functions = [];

  for (const sourcePath of exportedModules) {
    const exports = exportsByPath.get(sourcePath);
    if (!exports) {
      continue;
    }

    for (const name of exports.functions) {
      functions.push({ name, sourcePath, kind: "function" });
    }

    for (const name of exports.classes) {
      functions.push({ name, sourcePath, kind: "class" });
    }
  }

  return functions.sort((left, right) => left.name.localeCompare(right.name));
}

function collectPublicTypes() {
  const types = new Map();

  for (const sourcePath of exportedModules) {
    const exports = exportsByPath.get(sourcePath);
    if (!exports) {
      continue;
    }

    for (const name of sortSet(exports.types)) {
      if (!types.has(name)) {
        types.set(name, sourcePath);
      }
    }
  }

  return types;
}

function buildApiFunctionPages() {
  return Object.fromEntries(
    publicFunctions.map(({ name, sourcePath, kind }) => {
      const enhancements = pageEnhancements[name] ?? {};
      const href = `/api/${functionSlug(name)}/`;

      return [
        name,
        {
          title: kind === "class" ? name : `${name}()`,
          description: exportDescriptions[name] ?? `Public ${kind} exported by causal-order.`,
          sourcePath,
          kind,
          signatures: enhancements.signatures ?? (
            kind === "class"
              ? extractAllClassDeclarations(readSource(sourcePath), name)
              : extractAllFunctionDeclarations(readSource(sourcePath), name)
          ),
          href,
          sourceUrl: toSourceUrl(sourcePath),
          primary: enhancements.primary ?? false,
          summary: enhancements.summary ?? null,
          usage: enhancements.usage ?? null,
          bullets: enhancements.bullets ?? [],
          deprecated: deprecatedPages[name] ?? null,
        },
      ];
    }),
  );
}

function buildNavigationItems(apiFunctionPages) {
  const sectionDefinitions = [
    {
      title: "Start",
      entries: [{ title: "Overview", href: "/api/" }],
    },
    {
      title: "Core Flow",
      pageNames: ["translateBatch", "orderEvents", "orderEventStream"],
    },
    {
      title: "Inspection",
      pageNames: ["inspectOrderResult", "inspectOrderBatch"],
    },
    {
      title: "Targeted Helpers",
      pageNames: ["validateEvent", "compareByCausality"],
    },
    {
      title: "Reference",
      entries: [{ title: "Types", href: "/api/types/" }],
    },
  ];

  return sectionDefinitions
    .map((section) => {
      const items = [
        ...(section.entries ?? []),
        ...((section.pageNames ?? [])
          .map((name) => apiFunctionPages[name])
          .filter(Boolean)
          .map((page) => ({
            title: page.title,
            href: page.href,
          }))),
      ];

      return items.length > 0
        ? {
            title: section.title,
            items,
          }
        : null;
    })
    .filter(Boolean);
}

function buildOverviewGroups() {
  const groups = [];

  for (const group of apiGroupDefinitions) {
    const items = [];

    for (const sourcePath of exportedModules.filter((value) => value.startsWith(group.prefix))) {
      const exports = exportsByPath.get(sourcePath);
      if (!exports) {
        continue;
      }

      for (const name of sortSet(exports.consts)) {
        items.push(symbolItem(name, sourcePath, { kind: "const" }));
      }

      for (const name of sortSet(exports.classes)) {
        items.push(symbolItem(name, sourcePath, { kind: "class" }));
      }

      for (const name of sortSet(exports.functions)) {
        items.push(symbolItem(name, sourcePath));
      }
    }

    if (items.length > 0) {
      groups.push({ title: group.title, items });
    }
  }

  return groups;
}

function buildFocusedEntrypoints() {
  return Object.keys(repoPackage.exports).map((subpath) => ({
    path: formatPackageEntrypoint(subpath),
    description:
      subpathDescriptions[subpath] ??
      `Focused public entrypoint exported by ${repoPackage.name}.`,
  }));
}

function formatPackageEntrypoint(subpath) {
  return subpath === "."
    ? repoPackage.name
    : `${repoPackage.name}/${subpath.replace(/^\.\//, "")}`;
}

function functionSlug(name) {
  const slugOverrides = {
    orderEvents: "order-events",
    orderEventStream: "order-event-stream",
    validateEvent: "validate-event",
    validateClock: "validate-clock",
    compareByCausality: "compare-by-causality",
    compareByHlc: "compare-by-hlc",
    compareClocks: "compare-clocks",
  };

  return slugOverrides[name] ?? name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function sortSet(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}
