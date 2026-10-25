import { CLUSTER_EDGES } from '@/engine/topology/clusterTopology';
import type { ClusterTelemetrySnapshot } from '@/types/telemetry';
import type { ServiceId } from '@/types/topology';
import { serializeTelemetryDiff } from './compactSerializer';

export const SYSTEM1_SYSTEM_PROMPT = `You are the CrashLens System 1 Reflex Engine. Make fast, conservative SRE decisions.
Identify whether an anomaly exists, choose one root cause, trace affected callers, and recommend one concrete action.
Return ONLY a JSON object with anomalyDetected, confidence, rootCauseService, failureMode, timeToCriticalSec, blastRadiusServices, and recommendedAction (actionId, title, targetService, parameters, estimatedRiskReductionPct). Use only service IDs and actions supported by the telemetry.`;

export function buildSystem1UserPrompt(
  snapshot: ClusterTelemetrySnapshot,
  zScores: Map<ServiceId, number>
): string {
  const graph = CLUSTER_EDGES.map((edge) => `${edge.source}>${edge.target}`).join(',');
  return `TOPOLOGY_CALLS: ${graph}\nTELEMETRY_DIFF:\n${serializeTelemetryDiff(snapshot, zScores)}`;
}
