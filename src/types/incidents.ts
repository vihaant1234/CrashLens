/**
 * CrashLens Chaos & Incident Injector Types
 * Defines the 4 deterministic failure scenarios and runtime incident states.
 */

import type { ServiceId } from './topology';

export type ScenarioId =
  | 'DB_POOL_LEAK'
  | 'CACHE_STAMPEDE'
  | 'THREAD_STARVATION'
  | 'RETRY_STORM';

export interface IncidentConfig {
  id: ScenarioId;
  title: string;
  rootCauseService: ServiceId;
  description: string;
  cascadeOrder: ServiceId[];
  durationTicks: number;
}

export interface IncidentState {
  scenarioId: ScenarioId;
  config: IncidentConfig;
  startedAtTick: number;
  elapsedTicks: number;
}

export const INCIDENT_CONFIGS: Record<ScenarioId, IncidentConfig> = {
  DB_POOL_LEAK: {
    id: 'DB_POOL_LEAK',
    title: 'PostgreSQL Connection Pool Leak',
    rootCauseService: 'payments-db',
    description: 'Unclosed transactional connections starve payments-svc and cascade to orders-svc',
    cascadeOrder: ['payments-db', 'payments-svc', 'orders-svc', 'api-gateway'],
    durationTicks: 45,
  },
  CACHE_STAMPEDE: {
    id: 'CACHE_STAMPEDE',
    title: 'Cache Invalidation Stampede',
    rootCauseService: 'redis-cache',
    description: 'Hot-key TTL drop causes 8x query surge slamming inventory and warehouse-db',
    cascadeOrder: ['redis-cache', 'inventory', 'warehouse-db', 'cart'],
    durationTicks: 40,
  },
  THREAD_STARVATION: {
    id: 'THREAD_STARVATION',
    title: 'Cryptographic Thread Starvation',
    rootCauseService: 'auth-svc',
    description: 'Heavy bcrypt rehashing burts block event loop threads and exhaust Gateway sockets',
    cascadeOrder: ['auth-svc', 'api-gateway'],
    durationTicks: 35,
  },
  RETRY_STORM: {
    id: 'RETRY_STORM',
    title: 'Exponential Backoff Retry Storm',
    rootCauseService: 'notification-svc',
    description: 'Transient broker partition with aggressive retries triggers memory leak in orders-svc',
    cascadeOrder: ['notification-svc', 'orders-svc', 'cart'],
    durationTicks: 40,
  },
};
