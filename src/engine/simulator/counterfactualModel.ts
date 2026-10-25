import { CLUSTER_NODE_MAP } from '@/engine/topology/clusterTopology';
import { INCIDENT_CONFIGS, type ScenarioId } from '@/types/incidents';
import type { ServiceId } from '@/types/topology';

export interface CounterfactualPoint {
  tick: number;
  p99Ms: number;
  errorRatePct: number;
  rootStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DEAD';
  ordersStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DEAD';
  gatewayStatus: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DEAD';
}

export interface CounterfactualPair {
  mitigated: CounterfactualPoint[];
  unmitigated: CounterfactualPoint[];
  impact: {
    droppedTransactions: { mitigated: number; unmitigated: number };
    downtimeSec: { mitigated: number; unmitigated: number };
    revenueAtRisk: { mitigated: number; unmitigated: number };
  };
}

function statusFor(errorRatePct: number): CounterfactualPoint['rootStatus'] {
  if (errorRatePct >= 70) return 'DEAD';
  if (errorRatePct >= 25) return 'CRITICAL';
  if (errorRatePct >= 3) return 'DEGRADED';
  return 'HEALTHY';
}

export function generateCounterfactualPair(
  incidentId: ScenarioId,
  durationTicks = 45
): CounterfactualPair {
  const root = INCIDENT_CONFIGS[incidentId].rootCauseService;
  const baselineP99 = CLUSTER_NODE_MAP[root].baselines.p99Ms;
  const mitigated: CounterfactualPoint[] = [];
  const unmitigated: CounterfactualPoint[] = [];

  for (let tick = 0; tick < durationTicks; tick++) {
    const intensity = scenarioIntensity(incidentId, tick);
    const peakP99 = incidentId === 'DB_POOL_LEAK'
      ? 14 + 450 * intensity ** 3
      : baselineP99 + Math.max(1, baselineP99 * 12) * intensity;
    const unmitigatedError = errorCurve(incidentId, tick);
    const unmitigatedP99 = cascadeP99(incidentId, tick, baselineP99, peakP99);
    const savedError = tick <= 14
      ? 0.02 + intensity * 0.12
      : 0.02 + intensity * 0.12 * Math.exp(-1.05 * (tick - 14));
    const savedP99 = tick <= 14
      ? Math.round(peakP99)
      : Math.round(baselineP99 + Math.max(0, peakP99 - baselineP99) * Math.exp(-1.05 * (tick - 14)));

    mitigated.push({
      tick,
      p99Ms: tick >= 19 ? baselineP99 : Math.max(baselineP99, savedP99),
      errorRatePct: tick >= 19 ? 0.02 : savedError,
      rootStatus: tick >= 19 ? 'HEALTHY' : statusFor(savedError),
      ordersStatus: 'HEALTHY',
      gatewayStatus: 'HEALTHY',
    });
    unmitigated.push({
      tick,
      p99Ms: unmitigatedP99,
      errorRatePct: tick >= 40 ? 94.2 : Number(unmitigatedError.toFixed(2)),
      rootStatus: statusFor(unmitigatedError),
      ordersStatus: tick >= 20 ? (tick >= 28 ? 'CRITICAL' : 'DEGRADED') : 'HEALTHY',
      gatewayStatus: tick >= 34 ? 'DEAD' : tick >= 32 ? 'CRITICAL' : 'HEALTHY',
    });
  }

  return {
    mitigated,
    unmitigated,
    impact: {
      droppedTransactions: { mitigated: 4, unmitigated: 1420 },
      downtimeSec: { mitigated: 0, unmitigated: 182 },
      revenueAtRisk: { mitigated: 240, unmitigated: 184000 },
    },
  };
}

export function scenarioRoot(incidentId: ScenarioId): ServiceId {
  return INCIDENT_CONFIGS[incidentId].rootCauseService;
}

function scenarioIntensity(incidentId: ScenarioId, tick: number): number {
  switch (incidentId) {
    case 'DB_POOL_LEAK':
      return Math.min(1, 0.2 + 0.035 * Math.pow(tick, 1.4));
    case 'CACHE_STAMPEDE':
      return Math.min(1, 0.12 + tick * 0.035);
    case 'THREAD_STARVATION':
      return Math.min(1, 0.08 + tick * 0.03);
    case 'RETRY_STORM':
      return Math.min(1, 0.08 + tick * 0.028);
  }
}

function errorCurve(incidentId: ScenarioId, tick: number): number {
  if (incidentId === 'DB_POOL_LEAK') {
    if (tick < 14) return Number((0.02 + tick * 0.01).toFixed(2));
    if (tick <= 32) return Number(Math.min(68, 0.16 + (tick - 14) * 3.77).toFixed(2));
    return Number(Math.min(94.2, 68 + (tick - 32) * 3.275).toFixed(2));
  }
  return Number(Math.min(94.2, 0.02 + tick ** 1.55 * 0.16).toFixed(2));
}

function cascadeP99(
  incidentId: ScenarioId,
  tick: number,
  baselineP99: number,
  rootP99: number
): number {
  if (incidentId !== 'DB_POOL_LEAK') {
    return Math.round(baselineP99 + Math.max(0, tick - 8) ** 1.8 * 17 + rootP99 * 0.35);
  }
  if (tick >= 34) return 3400;
  if (tick >= 32) return Math.round(18 + (tick - 28) * 120);
  if (tick >= 20) return Math.round(42 + (tick - 18) * 70);
  if (tick >= 12) return Math.round(55 + (tick - 8) * 45);
  return Math.round(Math.max(baselineP99, rootP99));
}
