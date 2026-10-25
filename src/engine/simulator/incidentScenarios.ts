/**
 * Deterministic Chaos Scenario Curves
 * Exact mathematical degradation equations modeling cascading failure physics across microservices.
 */

import type { ServiceId, ServiceStatus } from '@/types/topology';
import type { NodeTelemetry, EdgeTelemetry, LogEntry } from '@/types/telemetry';
import type { ScenarioId } from '@/types/incidents';

export interface ScenarioMutationResult {
  nodeMutations: Partial<Record<ServiceId, Partial<NodeTelemetry>>>;
  edgeMutations: Record<string, Partial<EdgeTelemetry>>;
  statusOverrides: Partial<Record<ServiceId, ServiceStatus>>;
  additionalLogs: Record<ServiceId, LogEntry[]>;
}

/**
 * Calculates deterministic telemetry vector mutations for the current elapsed ticks of an incident.
 */
export function calculateIncidentMutations(
  scenarioId: ScenarioId,
  elapsedTicks: number,
  currentNodes: Record<ServiceId, NodeTelemetry>,
  timestamp: number
): ScenarioMutationResult {
  const nodeMutations: Partial<Record<ServiceId, Partial<NodeTelemetry>>> = {};
  const edgeMutations: Record<string, Partial<EdgeTelemetry>> = {};
  const statusOverrides: Partial<Record<ServiceId, ServiceStatus>> = {};
  const additionalLogs: Record<ServiceId, LogEntry[]> = {
    'payments-db': [],
    'payments-svc': [],
    'orders-svc': [],
    'api-gateway': [],
    'redis-cache': [],
    inventory: [],
    'warehouse-db': [],
    cart: [],
    'auth-svc': [],
    'notification-svc': [],
    'kafka-broker': [],
    recommendations: [],
    'fraud-svc': [],
  };

  switch (scenarioId) {
    case 'DB_POOL_LEAK': {
      // -------------------------------------------------------------
      // SCENARIO A: PostgreSQL Connection Pool Leak (payments-db)
      // -------------------------------------------------------------
      const t = Math.max(0, elapsedTicks);

      // 1. payments-db connection pool leak: poolUtil(t) = min(1.0, 0.20 + 0.035 * t^1.4)
      const leakedConns = Math.min(1.0, 0.2 + 0.035 * Math.pow(t, 1.4));
      // Latency scales cubically: p99 = 14 + 450 * (poolUtil)^3
      const dbP99 = Math.round(14 + 450 * Math.pow(leakedConns, 3));
      const dbCpu = Math.min(96, Math.round(20 + 40 * leakedConns));

      const dbStatus: ServiceStatus =
        leakedConns > 0.85 ? 'CRITICAL' : leakedConns > 0.55 ? 'DEGRADED' : 'HEALTHY';

      nodeMutations['payments-db'] = {
        status: dbStatus,
        metrics: {
          ...currentNodes['payments-db'].metrics,
          connectionPoolUtilization: Number(leakedConns.toFixed(3)),
          p99Ms: dbP99,
          cpuPct: dbCpu,
          errorRatePct: leakedConns > 0.9 ? 12.5 : 0.02,
        },
      };
      statusOverrides['payments-db'] = dbStatus;

      if (leakedConns > 0.6) {
        additionalLogs['payments-db'].push({
          level: leakedConns > 0.85 ? 'ERROR' : 'WARN',
          message: `[HikariCP] Connection pool exhausted: active=${Math.round(leakedConns * 100)}/100, pending=${Math.round(t * 2.5)}`,
          timestamp,
        });
      }

      // 2. Cascade to payments-svc: threads block waiting for connections (T >= 10s)
      if (t >= 8) {
        const stageT = t - 8;
        const svcLatency = Math.min(950, Math.round(55 + stageT * 45));
        const svcPooled = Math.min(1.0, 0.35 + stageT * 0.05);
        const svcStatus: ServiceStatus = svcLatency > 400 ? 'CRITICAL' : 'DEGRADED';

        nodeMutations['payments-svc'] = {
          status: svcStatus,
          metrics: {
            ...currentNodes['payments-svc'].metrics,
            p99Ms: svcLatency,
            connectionPoolUtilization: Number(svcPooled.toFixed(2)),
            errorRatePct: Math.min(28.0, Number((stageT * 1.8).toFixed(2))),
            threadPoolQueueDepth: Math.min(220, Math.round(stageT * 12)),
          },
        };
        statusOverrides['payments-svc'] = svcStatus;

        edgeMutations['payments-svc->payments-db'] = {
          latencyMs: dbP99,
          errorRatePct: leakedConns > 0.9 ? 14.0 : 2.5,
          saturationScore: Number(leakedConns.toFixed(2)),
        };

        if (stageT > 3) {
          additionalLogs['payments-svc'].push({
            level: 'ERROR',
            message: `DB timeout after ${svcLatency}ms acquiring ledger lock from payments-db`,
            timestamp,
          });
        }
      }

      // 3. Cascade to orders-svc: checkout saga coordinator queues fill up (T >= 18s)
      if (t >= 18) {
        const stageT = t - 18;
        const queueDepth = Math.min(500, Math.round(stageT * 32));
        const ordersError = Math.min(55.0, Number((stageT * 3.2).toFixed(1)));
        const ordersP99 = Math.min(1200, Math.round(42 + stageT * 70));
        const ordersStatus: ServiceStatus = ordersError > 20 ? 'CRITICAL' : 'DEGRADED';

        nodeMutations['orders-svc'] = {
          status: ordersStatus,
          metrics: {
            ...currentNodes['orders-svc'].metrics,
            threadPoolQueueDepth: queueDepth,
            errorRatePct: ordersError,
            p99Ms: ordersP99,
          },
        };
        statusOverrides['orders-svc'] = ordersStatus;

        edgeMutations['orders-svc->payments-svc'] = {
          latencyMs: ordersP99,
          errorRatePct: ordersError,
          saturationScore: 0.95,
        };

        additionalLogs['orders-svc'].push({
          level: 'FATAL',
          message: `HTTP 504 Gateway Timeout: payments-svc failed to respond in 1000ms`,
          timestamp,
        });
      }

      // 4. Cascade to api-gateway: Ingress thread pool starves (T >= 28s)
      if (t >= 28) {
        const stageT = t - 28;
        const gwError = Math.min(68.0, Number((20 + stageT * 4.5).toFixed(1)));
        const gwP99 = Math.min(1850, Math.round(18 + stageT * 120));

        nodeMutations['api-gateway'] = {
          status: 'CRITICAL',
          metrics: {
            ...currentNodes['api-gateway'].metrics,
            errorRatePct: gwError,
            p99Ms: gwP99,
            threadPoolQueueDepth: Math.min(500, Math.round(stageT * 40)),
          },
        };
        statusOverrides['api-gateway'] = 'CRITICAL';

        edgeMutations['api-gateway->cart'] = {
          latencyMs: 900,
          errorRatePct: gwError * 0.8,
          saturationScore: 1.0,
        };

        additionalLogs['api-gateway'].push({
          level: 'FATAL',
          message: `GLOBAL INGRESS SATURATION: ${gwError}% requests dropping (HTTP 503 Service Unavailable)`,
          timestamp,
        });
      }
      break;
    }

    case 'CACHE_STAMPEDE': {
      // -------------------------------------------------------------
      // SCENARIO B: Cache Invalidation Stampede (redis-cache)
      // -------------------------------------------------------------
      const t = Math.max(0, elapsedTicks);

      // Cache hit ratio drops immediately, latency spikes
      const cacheStatus: ServiceStatus = t > 3 ? 'CRITICAL' : 'DEGRADED';
      nodeMutations['redis-cache'] = {
        status: cacheStatus,
        metrics: {
          ...currentNodes['redis-cache'].metrics,
          p99Ms: Math.min(450, 2 + t * 25),
          cpuPct: Math.min(99, 15 + t * 5),
          errorRatePct: Math.min(42, Number((t * 2.8).toFixed(1))),
        },
      };
      statusOverrides['redis-cache'] = cacheStatus;

      additionalLogs['redis-cache'].push({
        level: 'ERROR',
        message: `TTL Hot-key expired on catalog:items:* — hit ratio dropped from 98.4% to 12.1%`,
        timestamp,
      });

      // 8x Query Surge hits inventory & warehouse-db (T >= 5s)
      if (t >= 5) {
        const stageT = t - 5;
        const whCpu = Math.min(100, Math.round(22 + stageT * 12));
        const whP99 = Math.min(1350, Math.round(16 + stageT * 95));

        nodeMutations['warehouse-db'] = {
          status: whCpu > 85 ? 'CRITICAL' : 'DEGRADED',
          metrics: {
            ...currentNodes['warehouse-db'].metrics,
            cpuPct: whCpu,
            p99Ms: whP99,
            errorRatePct: Math.min(38, Number((stageT * 3.0).toFixed(1))),
          },
        };
        statusOverrides['warehouse-db'] = whCpu > 85 ? 'CRITICAL' : 'DEGRADED';

        nodeMutations['inventory'] = {
          status: 'DEGRADED',
          metrics: {
            ...currentNodes['inventory'].metrics,
            p99Ms: Math.min(850, 28 + stageT * 60),
            threadPoolQueueDepth: Math.min(350, stageT * 25),
          },
        };
        statusOverrides['inventory'] = 'DEGRADED';

        edgeMutations['inventory->warehouse-db'] = {
          latencyMs: whP99,
          saturationScore: 0.98,
        };
      }
      break;
    }

    case 'THREAD_STARVATION': {
      // -------------------------------------------------------------
      // SCENARIO C: Cryptographic Thread Starvation (auth-svc)
      // -------------------------------------------------------------
      const t = Math.max(0, elapsedTicks);

      const authLatency = Math.min(2400, Math.round(12 + Math.pow(t, 2) * 4.2));
      const authCpu = Math.min(99, Math.round(22 + t * 4.5));
      const authStatus: ServiceStatus = authLatency > 1000 ? 'CRITICAL' : 'DEGRADED';

      nodeMutations['auth-svc'] = {
        status: authStatus,
        metrics: {
          ...currentNodes['auth-svc'].metrics,
          p99Ms: authLatency,
          cpuPct: authCpu,
          threadPoolQueueDepth: Math.min(500, t * 30),
          errorRatePct: Math.min(48, Number((t * 2.2).toFixed(1))),
        },
      };
      statusOverrides['auth-svc'] = authStatus;

      additionalLogs['auth-svc'].push({
        level: authLatency > 1000 ? 'FATAL' : 'WARN',
        message: `Bcrypt hash loop thread lock: event loop delay=${authLatency}ms`,
        timestamp,
      });

      // Gateway socket exhaustion (T >= 10s)
      if (t >= 10) {
        const stageT = t - 10;
        nodeMutations['api-gateway'] = {
          status: 'DEGRADED',
          metrics: {
            ...currentNodes['api-gateway'].metrics,
            errorRatePct: Math.min(34, Number((stageT * 2.5).toFixed(1))),
            threadPoolQueueDepth: Math.min(400, stageT * 20),
          },
        };
        statusOverrides['api-gateway'] = 'DEGRADED';
      }
      break;
    }

    case 'RETRY_STORM': {
      // -------------------------------------------------------------
      // SCENARIO D: Exponential Backoff Retry Storm (notification-svc)
      // -------------------------------------------------------------
      const t = Math.max(0, elapsedTicks);

      nodeMutations['notification-svc'] = {
        status: 'CRITICAL',
        metrics: {
          ...currentNodes['notification-svc'].metrics,
          p99Ms: Math.min(1600, 32 + t * 75),
          errorRatePct: Math.min(85, 5 + t * 4),
          threadPoolQueueDepth: Math.min(500, t * 25),
        },
      };
      statusOverrides['notification-svc'] = 'CRITICAL';

      // Memory leak in orders-svc due to pending retry saga retention
      if (t >= 6) {
        const stageT = t - 6;
        const ordersMem = Math.min(98.5, Number((45 + stageT * 3.8).toFixed(1)));
        nodeMutations['orders-svc'] = {
          status: ordersMem > 85 ? 'CRITICAL' : 'DEGRADED',
          metrics: {
            ...currentNodes['orders-svc'].metrics,
            memPct: ordersMem,
            errorRatePct: Math.min(45, Number((stageT * 2.5).toFixed(1))),
          },
        };
        statusOverrides['orders-svc'] = ordersMem > 85 ? 'CRITICAL' : 'DEGRADED';

        additionalLogs['orders-svc'].push({
          level: ordersMem > 85 ? 'FATAL' : 'WARN',
          message: `JVM heap memory creep: ${ordersMem}% utilized (retry amplification buffer leaking)`,
          timestamp,
        });
      }
      break;
    }
  }

  return {
    nodeMutations,
    edgeMutations,
    statusOverrides,
    additionalLogs,
  };
}
