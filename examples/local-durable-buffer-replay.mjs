import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import {
  inspectOrderResult,
  orderEvents,
  translateBatch,
} from "causal-order"
import {
  isDirectRun,
  printHeader,
  printJson,
  printOrderResult,
  printTranslationResult,
} from "./_shared.mjs"

export async function run() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "causal-order-durable-buffer-"))
  const bufferPath = path.join(tempDir, "replay-buffer.jsonl")

  const bufferedRecords = [
    {
      eventId: "order-created",
      nodeId: "device-a",
      occurredAt: "1000",
      sequence: 1n,
      payload: { type: "order.created", orderId: "ord-100" },
    },
    {
      eventId: "inventory-reserved",
      nodeId: "inventory-service",
      occurredAt: 1200,
      parentEventId: "order-created",
      payload: { type: "inventory.reserved", orderId: "ord-100" },
    },
    {
      eventId: "order-created-replayed-copy",
      nodeId: "replay-import",
      occurredAt: 1100n,
      parentEventId: "order-created",
      payload: { type: "order.created.replayed_copy", orderId: "ord-100" },
    },
    {
      eventId: "broken-buffer-row",
      nodeId: "device-b",
      occurredAt: "2024-05-06T12:24:00Z",
      payload: { type: "invalid.timestamp" },
    },
  ]

  try {
    await writeBufferFile(bufferPath, bufferedRecords)

    printHeader("Local Durable Buffer Replay")
    console.log("This integration-shaped example treats disk-backed JSONL as a local durable replay buffer.")
    console.log(`Buffer file: ${bufferPath}`)
    console.log("Buffered raw records:")
    printJson(bufferedRecords)

    const replayRecords = await readBufferFile(bufferPath)

    const translated = translateBatch(replayRecords, {
      getEventId: (record) => record.eventId,
      getNodeId: (record) => record.nodeId,
      getPhysicalTime: (record) => record.occurredAt,
      getSequence: (record) => record.sequence,
      getParentEventId: (record) => record.parentEventId,
      getPayload: (record) => record.payload,
    })

    printTranslationResult(translated)

    const ordered = orderEvents(translated.translated, {
      strict: false,
      detectAnomalies: true,
    })
    const inspection = inspectOrderResult(ordered)

    printOrderResult(ordered)

    console.log("Replay inspection summary:")
    printJson({
      stats: inspection.stats,
      counts: inspection.counts,
      anomalySummary: inspection.anomalySummary,
      ordered: inspection.ordered.map((entry) => ({
        eventId: entry.eventId,
        orderBasis: entry.orderBasis,
        confidence: entry.confidence,
        summary: entry.summary,
      })),
    })
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

async function writeBufferFile(filePath, records) {
  const lines = records.map((record) =>
    JSON.stringify(record, (_key, value) =>
      typeof value === "bigint" ? `${value.toString()}n` : value,
    ),
  )

  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8")
}

async function readBufferFile(filePath) {
  const raw = await readFile(filePath, "utf8")

  return raw
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) =>
      JSON.parse(line, (_key, value) => {
        if (typeof value === "string" && /^-?\d+n$/.test(value)) {
          return BigInt(value.slice(0, -1))
        }

        return value
      }),
    )
}

if (isDirectRun(import.meta.url)) {
  await run()
}
