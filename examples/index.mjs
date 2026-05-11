import { run as runCausalInversion } from "./causal-inversion.mjs"
import { run as runFalseAuditTimeline } from "./false-audit-timeline.mjs"
import { run as runMultiRegionDrift } from "./multi-region-drift.mjs"
import { run as runOfflineSyncAnomalies } from "./offline-sync-anomalies.mjs"
import { run as runReplayCorruption } from "./replay-corruption.mjs"
import { run as runStreamingRecoveryResync } from "./streaming-recovery-resync.mjs"

runReplayCorruption()
runMultiRegionDrift()
runFalseAuditTimeline()
runOfflineSyncAnomalies()
await runStreamingRecoveryResync()
runCausalInversion()
