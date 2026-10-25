import { CLUSTER_NODE_MAP } from '@/engine/topology/clusterTopology';
import type { ClusterTelemetrySnapshot, NodeTelemetry } from '@/types/telemetry';
import type { ServiceId } from '@/types/topology';
import type { PredictionResult, ServiceAnomaly } from '@/types/prediction';
import { getClusterSimulator } from '@/engine/simulator/ClusterSimulator';
import { traceBlastRadius } from './DagPercolation';
import { computeRollingZScore } from './rollingStats';

const ANOMALY_THRESHOLD = 2.5;
const EPSILON = 1e-6;

type HistoryProvider = (serviceId: ServiceId) => NodeTelemetry[];

function localAction(
  rootCause: ServiceId
): PredictionResult['recommendedAction'] {
  if (rootCause === 'payments-db') {
    return {
      actionId: 'CONNECTION_POOL_RECYCLE',
      title: 'Recycle the payments database connection pool',
      targetService: rootCause,
      parameters: { poolMaxConnections: 100 },
      estimatedRiskReductionPct: 88,
    };
  }
  return {
    actionId: 'CIRCUIT_BREAKER_TRIP',
    title: `Isolate ${rootCause} with a circuit breaker`,
    targetService: rootCause,
    parameters: { failureThreshold: 5, openCircuitMs: 3000 },
    estimatedRiskReductionPct: 65,
  };
}

export class AnomalyDetector {
  private readonly scoreHistory = new Map<ServiceId, number[]>();
  private readonly firstDetectedAt = new Map<ServiceId, number>();
  private readonly previousAnomalies = new Set<ServiceId>();

  constructor(private readonly historyProvider: HistoryProvider = (serviceId) =>
    getClusterSimulator().getServiceHistory(serviceId)) {}

  analyze(snapshot: ClusterTelemetrySnapshot): {
    anomalies: ServiceAnomaly[];
    zScores: Map<ServiceId, number>;
    prediction: PredictionResult;
  } {
    const anomalies: ServiceAnomaly[] = [];
    const anomalyScores = new Map<ServiceId, number>();
    const degraded = new Set<ServiceId>();
    const allScores = new Map<ServiceId, number>();

    for (const [serviceId, telemetry] of Object.entries(snapshot.nodes) as [
      ServiceId,
      ClusterTelemetrySnapshot['nodes'][ServiceId],
    ][]) {
      const history = this.historyProvider(serviceId).slice(-60);
      const baseline = CLUSTER_NODE_MAP[serviceId].baselines;
      const p99Z = computeRollingZScore(
        telemetry.metrics.p99Ms,
        history.map((sample) => sample.metrics.p99Ms).length >= 2
          ? history.map((sample) => sample.metrics.p99Ms)
          : [baseline.p99Ms * 0.94, baseline.p99Ms, baseline.p99Ms * 1.06]
      );
      const errorZ = computeRollingZScore(
        telemetry.metrics.errorRatePct,
        history.map((sample) => sample.metrics.errorRatePct).length >= 2
          ? history.map((sample) => sample.metrics.errorRatePct)
          : [0.01, 0.02, 0.03]
      );
      const cpuZ = computeRollingZScore(
        telemetry.metrics.cpuPct,
        history.map((sample) => sample.metrics.cpuPct).length >= 2
          ? history.map((sample) => sample.metrics.cpuPct)
          : [baseline.cpuPct * 0.9, baseline.cpuPct, baseline.cpuPct * 1.1]
      );
      const score = 0.5 * p99Z + 0.3 * errorZ + 0.2 * cpuZ;
      const scores = this.scoreHistory.get(serviceId) ?? [];
      const priorScore = scores.length >= 3 ? scores[scores.length - 3] : score;
      const velocity = (score - priorScore) / Math.max(1, Math.min(3, scores.length));
      scores.push(score);
      if (scores.length > 60) scores.shift();
      this.scoreHistory.set(serviceId, scores);
      allScores.set(serviceId, score);

      if (score > ANOMALY_THRESHOLD && !this.previousAnomalies.has(serviceId)) {
        this.firstDetectedAt.set(serviceId, snapshot.timestamp);
      } else if (score <= ANOMALY_THRESHOLD) {
        this.firstDetectedAt.delete(serviceId);
      }
      if (score > ANOMALY_THRESHOLD) {
        anomalyScores.set(serviceId, score);
        anomalies.push({
          serviceId,
          zScore: score,
          velocity,
          anomalous: true,
          firstDetectedAt: this.firstDetectedAt.get(serviceId) ?? snapshot.timestamp,
        });
      }
      if (telemetry.status !== 'HEALTHY') degraded.add(serviceId);
    }

    this.previousAnomalies.clear();
    for (const anomaly of anomalies) this.previousAnomalies.add(anomaly.serviceId);

    const percolation = traceBlastRadius(
      anomalyScores,
      degraded,
      this.firstDetectedAt
    );
    const rootCauseService = percolation?.rootCauseService ?? null;
    const rootAnomaly = anomalies.find((item) => item.serviceId === rootCauseService);
    const score = rootAnomaly?.zScore ?? Math.max(0, ...allScores.values());
    const velocity = rootAnomaly?.velocity ?? 0;
    const timeToCriticalSec = rootCauseService
      ? Math.max(5, Math.min(90, (10 - score) / (velocity + EPSILON)))
      : 0;
    const anomalyDetected = anomalies.length > 0;

    return {
      anomalies,
      zScores: allScores,
      prediction: {
        source: 'TIER_0_LOCAL_DETERMINISTIC',
        anomalyDetected,
        confidence: anomalyDetected ? Math.min(0.99, 0.55 + score / 30) : 0,
        rootCauseService,
        failureMode: rootCauseService ? failureMode(rootCauseService) : 'NONE',
        timeToCriticalSec,
        blastRadiusServices: percolation?.blastRadiusServices ?? [],
        recommendedAction: rootCauseService
          ? localAction(rootCauseService)
          : {
              actionId: 'NO_ACTION',
              title: 'No mitigation required',
              targetService: 'api-gateway',
              parameters: {},
              estimatedRiskReductionPct: 0,
            },
      },
    };
  }
}

function failureMode(serviceId: ServiceId): string {
  if (serviceId === 'payments-db') return 'DB_CONNECTION_POOL_LEAK';
  if (serviceId === 'redis-cache') return 'CACHE_STAMPEDE';
  if (serviceId === 'auth-svc') return 'THREAD_STARVATION';
  if (serviceId === 'notification-svc') return 'RETRY_STORM';
  return 'SERVICE_DEGRADATION';
}

let detector: AnomalyDetector | null = null;

export function analyzeClusterLocally(snapshot: ClusterTelemetrySnapshot) {
  if (!detector) detector = new AnomalyDetector();
  return detector.analyze(snapshot);
}
