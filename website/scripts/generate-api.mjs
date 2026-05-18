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
  detectSingleEventAnomalies: "Detects anomalies that can be inferred from one event in isolation.",
  detectAnomalies: "Detects structured anomalies across a bounded event set.",
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
const typeDescriptions = {
  NodeId: "Branded node identifier used to separate same-node and cross-node reasoning.",
  EventId: "Branded event identifier used for duplicate and reference checks.",
  HlcTimestamp: "Serialized hybrid logical clock string.",
  ValidatedHlcTimestamp: "Branded HLC timestamp that has passed validation.",
  EventEnvelope: "Public shape for an input event and its ordering metadata.",
  ValidatedEventEnvelope: "Validated event envelope safe for downstream ordering logic.",
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
  OrderStats: "Summary counts describing the outcome of a bounded ordering run.",
  OrderResult: "Top-level bounded ordering result containing ordered events, anomalies, and stats.",
  TieBreaker: "Deterministic comparison function used when stronger ordering is absent.",
  OrderOptions: "Options controlling bounded ordering behavior and anomaly handling.",
  CorrectionScope: "Indicates whether a stream correction is local to a batch or broader in scope.",
  CorrectionNotice: "Structured notice attached to correction-capable stream batches.",
  StreamAnomalyHorizon: "Anomaly carry model for stream windows and emitted history.",
  LateArrivalPolicy: "Policy controlling how late stream events are surfaced or rejected.",
  WatermarkSignal: "Structured watermark progress signal returned by watermark helpers.",
  WatermarkFunction: "Function shape used to derive stream watermark progress.",
  StreamOrderOptions: "Options controlling streaming ordering, watermarking, and correction behavior.",
  OrderBatch: "Structured batch emitted by streaming ordering.",
};

const navigationItems = [
  { key: "overview", title: "Overview", href: "/api/" },
  { key: "orderEvents", title: "orderEvents()", href: "/api/order-events/" },
  { key: "orderEventStream", title: "orderEventStream()", href: "/api/order-event-stream/" },
  { key: "validateEvent", title: "validateEvent()", href: "/api/validate-event/" },
  { key: "compareByCausality", title: "compareByCausality()", href: "/api/compare-by-causality/" },
  { key: "types", title: "Types", href: "/api/types/" },
];

const apiPages = {
  orderEvents: {
    title: "orderEvents()",
    description:
      "Orders a bounded set of distributed events and returns ordered output, anomalies, and summary stats.",
    sourcePath: "src/order/orderEvents.ts",
    signatures: extractFunctionDeclarations(
      readSource("src/order/orderEvents.ts"),
      "orderEvents",
      1,
    ),
  },
  orderEventStream: {
    title: "orderEventStream()",
    description:
      "Consumes an async iterable of events and emits ordered stream batches with watermark-aware behavior.",
    sourcePath: "src/order/orderEventStream.ts",
    signatures: extractFunctionDeclarations(
      readSource("src/order/orderEventStream.ts"),
      "orderEventStream",
      1,
    ),
  },
  validateEvent: {
    title: "validateEvent()",
    description:
      "Validates an event envelope and returns either a branded validated value or structured errors and warnings.",
    sourcePath: "src/validate/validateEvent.ts",
    signatures: extractFunctionDeclarations(
      readSource("src/validate/validateEvent.ts"),
      "validateEvent",
      2,
    ),
  },
  compareByCausality: {
    title: "compareByCausality()",
    description:
      "Performs a pairwise causality comparison without pretending weak metadata is causal proof.",
    sourcePath: "src/compare/causalCompare.ts",
    signatures: extractFunctionDeclarations(
      readSource("src/compare/causalCompare.ts"),
      "compareByCausality",
      1,
    ),
  },
  types: {
    title: "Types",
    description: "The main public types exported by causal-order.",
    sourcePath: "src/types.ts",
    signatures: [],
  },
};

const exportedModules = extractExportedModules(readSource("src/index.ts"));
const exportsByPath = new Map(
  exportedModules.map((sourcePath) => [sourcePath, extractExports(readSource(sourcePath))]),
);

const overviewGroups = [
  {
    title: "Clocks",
    items: [
      symbolItem("HlcClock", "src/clock/hlc.ts", { kind: "type" }),
      symbolItem("createHlcClock", "src/clock/hlc.ts"),
      symbolItem("parseHlc", "src/clock/parse.ts"),
      symbolItem("serializeHlc", "src/clock/serialize.ts"),
    ],
  },
  {
    title: "Comparison",
    items: [
      symbolItem("compareByHlc", "src/compare/hlcCompare.ts"),
      symbolItem("compareClocks", "src/compare/hlcCompare.ts"),
      symbolItem("compareByCausality", "src/compare/causalCompare.ts"),
      symbolItem("compareValidatedByCausality", "src/compare/causalCompare.ts"),
      symbolItem("applyTieBreaker", "src/compare/deterministicCompare.ts"),
      symbolItem("compareDeterministically", "src/compare/deterministicCompare.ts"),
      symbolItem("compareValidatedDeterministically", "src/compare/deterministicCompare.ts"),
    ],
  },
  {
    title: "Validation",
    items: [
      symbolItem("validateClock", "src/validate/validateClock.ts"),
      symbolItem("validateEvent", "src/validate/validateEvent.ts"),
    ],
  },
  {
    title: "Anomalies",
    items: [
      symbolItem("detectSingleEventAnomalies", "src/anomalies/detectAnomalies.ts"),
      symbolItem("detectAnomalies", "src/anomalies/detectAnomalies.ts"),
    ],
  },
  {
    title: "Ordering",
    items: [
      symbolItem("DEFAULT_TIE_BREAKER", "src/order/tieBreakers.ts", { kind: "const" }),
      symbolItem("getTieBreaker", "src/order/tieBreakers.ts"),
      symbolItem("compareWithTieBreaker", "src/order/tieBreakers.ts"),
      symbolItem("orderValidatedEvents", "src/order/orderEvents.ts"),
      symbolItem("orderEvents", "src/order/orderEvents.ts"),
      symbolItem("orderEventStream", "src/order/orderEventStream.ts"),
      symbolItem("eventTimeWatermark", "src/order/watermarkStrategies.ts"),
      symbolItem("ingestedAtWatermark", "src/order/watermarkStrategies.ts"),
      symbolItem("createProcessingTimeWatermark", "src/order/watermarkStrategies.ts"),
    ],
  },
];

const exportedTypes = exportsByPath.get("src/types.ts")?.types ?? new Set();

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
      title: "Streaming types",
      items: [
        typeItem("CorrectionScope"),
        typeItem("CorrectionNotice"),
        typeItem("StreamAnomalyHorizon"),
        typeItem("LateArrivalPolicy"),
        typeItem("WatermarkSignal"),
        typeItem("WatermarkFunction", "WatermarkFunction<T>"),
        typeItem("StreamOrderOptions", "StreamOrderOptions<T>"),
        typeItem("OrderBatch", "OrderBatch<T = unknown>"),
      ],
    },
  ],
  confidenceModel: ["proven", "derived", "fallback", "unknown"],
};

const apiData = {
  generatedAt: new Date().toISOString(),
  repoUrl,
  sourceBaseUrl,
  navigation: [
    {
      title: "Reference",
      items: navigationItems.map(({ title, href }) => ({ title, href })),
    },
  ],
  overview: {
    title: "API Overview",
    description: "The public API surface exported by causal-order today.",
    sourcePath: "src/index.ts",
    sourceUrl: toSourceUrl("src/index.ts"),
  },
  exportsByGroup: overviewGroups,
  pages: Object.fromEntries(
    Object.entries(apiPages).map(([key, page]) => [
      key,
      {
        ...page,
        href: navigationItems.find((item) => item.key === key)?.href ?? "/api/",
        sourceUrl: toSourceUrl(page.sourcePath),
      },
    ]),
  ),
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

function extractExportedModules(indexSource) {
  return Array.from(
    indexSource.matchAll(/^export \* from "(.+?)"/gm),
    ([, specifier]) => `src/${specifier.replace(/^\.\//, "").replace(/\.js$/, ".ts")}`,
  );
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
  const types = new Set(
    Array.from(source.matchAll(/^export type (\w+)/gm), ([, name]) => name),
  );

  return { functions, consts, types };
}

function extractFunctionDeclarations(source, name, count) {
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

    if (declarations.length === count) {
      break;
    }
  }

  if (declarations.length !== count) {
    throw new Error(`Expected ${count} declaration(s) for ${name}, found ${declarations.length}`);
  }

  return declarations;
}

function countMatches(value, token) {
  return Array.from(value).filter((character) => character === token).length;
}

function symbolItem(name, sourcePath, options = {}) {
  const { kind = "function" } = options;
  const exports = exportsByPath.get(sourcePath);
  if (exports === undefined) {
    throw new Error(`Missing exports for ${sourcePath}`);
  }

  const exportSet = kind === "type" ? exports.types : kind === "const" ? exports.consts : exports.functions;
  if (!exportSet.has(name)) {
    throw new Error(`Expected ${name} in ${sourcePath}`);
  }

  return {
    name,
    kind,
    label: kind === "function" ? `${name}()` : name,
    description: exportDescriptions[name] ?? "",
    sourcePath,
    sourceUrl: toSourceUrl(sourcePath),
  };
}

function typeItem(name, label = name) {
  if (!exportedTypes.has(name)) {
    throw new Error(`Expected exported type ${name} in src/types.ts`);
  }

  return {
    name,
    label,
    description: typeDescriptions[name] ?? "",
    sourcePath: "src/types.ts",
    sourceUrl: toSourceUrl("src/types.ts"),
  };
}

function toSourceUrl(sourcePath) {
  return `${sourceBaseUrl}/${sourcePath.replaceAll(path.sep, "/")}`;
}
