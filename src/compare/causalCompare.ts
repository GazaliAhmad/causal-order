import type { CausalOrdering, EventEnvelope } from "../types.js"
import { compareBigInt } from "../internal/utils.js"
import { validateEvent } from "../validate/validateEvent.js"

function hasDependency<T>(event: EventEnvelope<T>, eventId: string): boolean {
  return (
    event.parentEventId === eventId ||
    event.dependencyEventIds?.includes(eventId) === true
  )
}

export function compareByCausality<T>(
  a: EventEnvelope<T>,
  b: EventEnvelope<T>,
): CausalOrdering {
  if (a.id === b.id) {
    return "equal"
  }

  const validationA = validateEvent(a)
  const validationB = validateEvent(b)
  if (!validationA.valid || !validationB.valid) {
    return "unknown"
  }

  if (hasDependency(b, a.id)) {
    return "before"
  }

  if (hasDependency(a, b.id)) {
    return "after"
  }

  if (a.nodeId === b.nodeId && a.sequence !== undefined && b.sequence !== undefined) {
    const sequenceComparison = compareBigInt(a.sequence, b.sequence)
    if (sequenceComparison < 0) {
      return "before"
    }
    if (sequenceComparison > 0) {
      return "after"
    }
    return "unknown"
  }

  return "unknown"
}
