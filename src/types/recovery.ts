import type { ServiceId } from './topology';

export type ActionType =
  | 'CIRCUIT_BREAKER_TRIP'
  | 'CONNECTION_POOL_RECYCLE'
  | 'ADAPTIVE_RATE_SHEDDING'
  | 'STALE_CACHE_FALLBACK'
  | 'THREAD_BULKHEAD_ISOLATION';

export interface RecoveryStrategy {
  id: string;
  actionType: ActionType;
  title: string;
  targetService: ServiceId;
  isRecommended: boolean;
  estimatedRiskReductionPct: number;
  estimatedTimeToRecoverSec: number;
  tradeoff: string;
  parameters: Record<string, string | number | boolean>;
}
