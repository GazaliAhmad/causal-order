import { run as runCausalInversion } from "./causal-inversion.mjs"
import { run as runFalseAuditTimeline } from "./false-audit-timeline.mjs"
import { run as runIngressMinimal } from "./ingress-minimal.mjs"
import { run as runIngressReplayPipeline } from "./ingress-replay-pipeline.mjs"
import { run as runLocalDurableBufferReplay } from "./local-durable-buffer-replay.mjs"
import { run as runMultiRegionDrift } from "./multi-region-drift.mjs"
import { run as runOfflineSyncAnomalies } from "./offline-sync-anomalies.mjs"
import { run as runReplayCorruption } from "./replay-corruption.mjs"
import { run as runStreamingRecoveryResync } from "./streaming-recovery-resync.mjs"

runIngressMinimal()
runIngressReplayPipeline()
await runLocalDurableBufferReplay()
runReplayCorruption()
runMultiRegionDrift()
runFalseAuditTimeline()
runOfflineSyncAnomalies()
await runStreamingRecoveryResync()
runCausalInversion()
