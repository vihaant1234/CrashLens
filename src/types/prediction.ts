import type { ServiceId } from './topology';

export interface PredictionResult {
  source: 'SYSTEM_1_AI' | 'TIER_0_LOCAL_DETERMINISTIC';
  model?: string;
  anomalyDetected: boolean;
  confidence: number;
  rootCauseService: ServiceId | null;
  failureMode: string;
  timeToCriticalSec: number;
  blastRadiusServices: ServiceId[];
  recommendedAction: {
    actionId: string;
    title: string;
    targetService: ServiceId;
    parameters: Record<string, string | number | boolean>;
    estimatedRiskReductionPct: number;
  };
}

export interface ServiceAnomaly {
  serviceId: ServiceId;
  zScore: number;
  velocity: number;
  anomalous: boolean;
  firstDetectedAt: number;
}
