import { CLUSTER_EDGES } from '@/engine/topology/clusterTopology';
import type { ServiceId } from '@/types/topology';

const SERVICE_IDS: ServiceId[] = [
  'api-gateway',
  'auth-svc',
  'cart',
  'recommendations',
  'orders-svc',
  'redis-cache',
  'inventory',
  'payments-svc',
  'payments-db',
  'fraud-svc',
  'warehouse-db',
  'notification-svc',
  'kafka-broker',
];

export interface PercolationResult {
  rootCauseService: ServiceId;
  blastRadiusServices: ServiceId[];
}

/**
 * Walks reverse dependency edges: services that call the culprit are the first
 * exposed services, followed by callers of those services.
 */
export function traceBlastRadius(
  anomalyScores: ReadonlyMap<ServiceId, number>,
  degradedServices: ReadonlySet<ServiceId>,
  firstDetectedAt: ReadonlyMap<ServiceId, number>
): PercolationResult | null {
  const candidates = [...anomalyScores.entries()].filter(([, score]) => score > 2.5);
  if (candidates.length === 0) return null;

  const onset = (id: ServiceId) => firstDetectedAt.get(id) ?? Number.MAX_SAFE_INTEGER;
  const callerCounts = new Map<ServiceId, number>();
  for (const edge of CLUSTER_EDGES) {
    callerCounts.set(edge.target, (callerCounts.get(edge.target) ?? 0) + 1);
  }

  const rootCauseService = candidates
    .map(([serviceId, score]) => {
      const callers = CLUSTER_EDGES.filter((edge) => edge.target === serviceId);
      const degradedCallerRatio = callers.length
        ? callers.filter((edge) => degradedServices.has(edge.source)).length / callers.length
        : 0;
      return {
        serviceId,
        score,
        onset: onset(serviceId),
        ratio: degradedCallerRatio,
        callerCount: callerCounts.get(serviceId) ?? 0,
      };
    })
    .sort(
      (a, b) =>
        a.onset - b.onset ||
        b.ratio - a.ratio ||
        b.score - a.score ||
        b.callerCount - a.callerCount
    )[0].serviceId;

  const seen = new Set<ServiceId>([rootCauseService]);
  const queue: ServiceId[] = [rootCauseService];
  const blastRadiusServices: ServiceId[] = [];

  while (queue.length > 0) {
    const target = queue.shift()!;
    for (const edge of CLUSTER_EDGES) {
      if (edge.target !== target || seen.has(edge.source)) continue;
      seen.add(edge.source);
      queue.push(edge.source);
      if (degradedServices.has(edge.source) || anomalyScores.has(edge.source)) {
        blastRadiusServices.push(edge.source);
      }
    }
  }

  return { rootCauseService, blastRadiusServices };
}

export function getReachableCallers(rootCauseService: ServiceId): ServiceId[] {
  const seen = new Set<ServiceId>([rootCauseService]);
  const queue = [rootCauseService];
  const reachable: ServiceId[] = [];

  while (queue.length) {
    const target = queue.shift()!;
    for (const edge of CLUSTER_EDGES) {
      if (edge.target === target && !seen.has(edge.source)) {
        seen.add(edge.source);
        queue.push(edge.source);
        reachable.push(edge.source);
      }
    }
  }

  return SERVICE_IDS.filter((id) => reachable.includes(id));
}
