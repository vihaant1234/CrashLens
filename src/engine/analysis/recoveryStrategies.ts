import type { PredictionResult } from '@/types/prediction';
import type { RecoveryStrategy } from '@/types/recovery';
import type { ServiceId } from '@/types/topology';

type StrategySet = [RecoveryStrategy, RecoveryStrategy, RecoveryStrategy];

const strategy = (
  id: string,
  actionType: RecoveryStrategy['actionType'],
  title: string,
  targetService: ServiceId,
  estimatedRiskReductionPct: number,
  estimatedTimeToRecoverSec: number,
  tradeoff: string,
  parameters: RecoveryStrategy['parameters'],
  isRecommended = false
): RecoveryStrategy => ({
  id,
  actionType,
  title,
  targetService,
  isRecommended,
  estimatedRiskReductionPct,
  estimatedTimeToRecoverSec,
  tradeoff,
  parameters,
});

const STRATEGIES: Record<string, StrategySet> = {
  DB_CONNECTION_POOL_LEAK: [
    strategy('pool-recycle', 'CONNECTION_POOL_RECYCLE', 'Recycle connection pool & clear leaked transactions', 'payments-db', 88, 3, 'Terminates leaked idle transactions and restores checkout capacity with no intentional traffic drop.', { poolMaxConnections: 100, drainTimeoutMs: 500 }, true),
    strategy('payments-breaker', 'CIRCUIT_BREAKER_TRIP', 'Trip circuit breaker on payments-svc', 'payments-svc', 65, 2, 'Fails fast during database recovery; a small share of card payments may need retry.', { latencyThresholdMs: 250, failureThreshold: 5 }),
    strategy('checkout-shed', 'ADAPTIVE_RATE_SHEDDING', 'Shed non-essential cart and analytics traffic', 'cart', 45, 4, 'Preserves checkout capacity by dropping recommendations and analytics traffic by 50%.', { shedPct: 50, trafficClasses: 'recommendations,analytics' }),
  ],
  CACHE_STAMPEDE: [
    strategy('cache-stale', 'STALE_CACHE_FALLBACK', 'Serve stale catalog while rebuilding hot keys', 'redis-cache', 86, 3, 'Catalog reads can be briefly stale while cache hit ratio recovers.', { staleTtlSec: 60, rebuildConcurrency: 8 }, true),
    strategy('inventory-breaker', 'CIRCUIT_BREAKER_TRIP', 'Protect warehouse reads with a circuit breaker', 'warehouse-db', 68, 2, 'Some inventory reads return a graceful fallback until database pressure drops.', { latencyThresholdMs: 250, failureThreshold: 5 }),
    strategy('catalog-shed', 'ADAPTIVE_RATE_SHEDDING', 'Throttle catalog refresh traffic', 'inventory', 48, 4, 'Reduces refresh throughput by 50%, delaying non-checkout catalog updates.', { shedPct: 50, trafficClasses: 'catalog-refresh' }),
  ],
  THREAD_STARVATION: [
    strategy('auth-bulkhead', 'THREAD_BULKHEAD_ISOLATION', 'Isolate authentication crypto workers', 'auth-svc', 84, 3, 'Caps expensive hash work in a dedicated pool; excess authentication requests queue briefly.', { workerThreads: 8, queueLimit: 200 }, true),
    strategy('auth-breaker', 'CIRCUIT_BREAKER_TRIP', 'Fail fast on saturated auth requests', 'auth-svc', 63, 2, 'Protects gateway sockets while a portion of sign-ins retry.', { latencyThresholdMs: 250, failureThreshold: 5 }),
    strategy('auth-shed', 'ADAPTIVE_RATE_SHEDDING', 'Limit burst authentication traffic', 'api-gateway', 46, 4, 'Preserves established sessions but may defer low-priority login attempts.', { shedPct: 40, trafficClasses: 'low-priority-auth' }),
  ],
  RETRY_STORM: [
    strategy('notification-bulkhead', 'THREAD_BULKHEAD_ISOLATION', 'Quarantine notification retry workers', 'notification-svc', 82, 3, 'Notification delivery is delayed while retry amplification is contained.', { workerThreads: 6, queueLimit: 300 }, true),
    strategy('broker-breaker', 'CIRCUIT_BREAKER_TRIP', 'Open broker circuit and buffer notifications', 'kafka-broker', 66, 2, 'Events are buffered and delivered after the broker connection stabilizes.', { latencyThresholdMs: 300, failureThreshold: 5 }),
    strategy('notification-shed', 'ADAPTIVE_RATE_SHEDDING', 'Throttle non-critical notification retries', 'notification-svc', 44, 4, 'Non-critical notifications are delayed to protect synchronous order processing.', { shedPct: 50, trafficClasses: 'non-critical-notifications' }),
  ],
};

export function generateRecoveryStrategies(
  prediction: PredictionResult
): RecoveryStrategy[] {
  const selected = STRATEGIES[prediction.failureMode] ??
    STRATEGIES.SERVICE_DEGRADATION ??
    STRATEGIES.DB_CONNECTION_POOL_LEAK;
  if (prediction.failureMode === 'SERVICE_DEGRADATION' && prediction.rootCauseService) {
    return selected.map((item, index) => ({
      ...item,
      targetService: prediction.rootCauseService!,
      isRecommended: index === 0,
    }));
  }
  return selected.map((item) => ({ ...item }));
}
