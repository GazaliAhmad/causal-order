import type { HlcTimestamp, NodeId } from "../types.js"
import { assertValidHlcTimestamp, assertValidNodeId, compareBigInt } from "../internal/utils.js"

export type HlcClock = {
  now(): HlcTimestamp
  receive(remote: HlcTimestamp): HlcTimestamp
  getState(): HlcTimestamp
}

export function createHlcClock(options: {
  nodeId: NodeId
  now?: () => bigint
  maxDriftMs?: bigint
}): HlcClock {
  assertValidNodeId(options.nodeId)

  const now = options.now ?? (() => BigInt(Date.now()))
  const maxDriftMs = options.maxDriftMs
  let state: HlcTimestamp = {
    physicalTimeMs: now(),
    logicalCounter: 0,
    nodeId: options.nodeId,
  }

  const readNow = (): bigint => {
    const current = now()
    if (current < 0n) {
      throw new Error("Clock source returned a negative timestamp")
    }
    return current
  }

  const cloneState = (): HlcTimestamp => ({
    physicalTimeMs: state.physicalTimeMs,
    logicalCounter: state.logicalCounter,
    nodeId: state.nodeId,
  })

  return {
    now(): HlcTimestamp {
      const physicalNow = readNow()

      if (physicalNow > state.physicalTimeMs) {
        state = {
          physicalTimeMs: physicalNow,
          logicalCounter: 0,
          nodeId: options.nodeId,
        }
        return cloneState()
      }

      state = {
        physicalTimeMs: state.physicalTimeMs,
        logicalCounter: state.logicalCounter + 1,
        nodeId: options.nodeId,
      }
      return cloneState()
    },

    receive(remote: HlcTimestamp): HlcTimestamp {
      assertValidHlcTimestamp(remote)

      const physicalNow = readNow()
      if (
        maxDriftMs !== undefined &&
        compareBigInt(remote.physicalTimeMs, physicalNow + maxDriftMs) === 1
      ) {
        throw new Error("Remote clock drift exceeds maxDriftMs")
      }

      const maxPhysicalTime = [state.physicalTimeMs, remote.physicalTimeMs, physicalNow]
        .reduce((max, current) => (current > max ? current : max))

      let logicalCounter: number

      if (
        maxPhysicalTime === state.physicalTimeMs &&
        maxPhysicalTime === remote.physicalTimeMs
      ) {
        logicalCounter = Math.max(state.logicalCounter, remote.logicalCounter) + 1
      } else if (maxPhysicalTime === state.physicalTimeMs) {
        logicalCounter = state.logicalCounter + 1
      } else if (maxPhysicalTime === remote.physicalTimeMs) {
        logicalCounter = remote.logicalCounter + 1
      } else {
        logicalCounter = 0
      }

      state = {
        physicalTimeMs: maxPhysicalTime,
        logicalCounter,
        nodeId: options.nodeId,
      }

      return cloneState()
    },

    getState(): HlcTimestamp {
      return cloneState()
    },
  }
}
