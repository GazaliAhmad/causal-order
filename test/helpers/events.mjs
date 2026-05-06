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

export async function collectAsync(iterable) {
  const items = []
  for await (const item of iterable) {
    items.push(item)
  }
  return items
}
