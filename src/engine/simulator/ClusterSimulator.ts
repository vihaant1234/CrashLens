/**
 * CrashLens Cluster Simulator
 * 1Hz high-frequency discrete event clock that emits realistic telemetry vectors
 * across all nodes and edges in the microservice topology.
 * Supports deterministic chaos injection scenarios.
 */

import {
  CLUSTER_NODES,
  CLUSTER_EDGES,
  CLUSTER_NODE_MAP,
} from '@/engine/topology/clusterTopology';
import { CircularRingBuffer } from './RingBuffer';
import {
  generateBaselineMetric,
  generateLatencyMetric,
  gaussianRandom,
} from './noiseModel';
import { calculateIncidentMutations } from './incidentScenarios';
import type {
  ServiceId,
  ServiceStatus,
  TopologyNode,
} from '@/types/topology';
import type {
  ClusterTelemetrySnapshot,
  EdgeTelemetry,
  NodeTelemetry,
  LogEntry,
} from '@/types/telemetry';
import {
  INCIDENT_CONFIGS,
  type ScenarioId,
  type IncidentState,
} from '@/types/incidents';
import type { RecoveryStrategy } from '@/types/recovery';

export type SnapshotSubscriber = (snapshot: ClusterTelemetrySnapshot) => void;

const REQUEST_PATHS: Record<ServiceId, string> = {
  'api-gateway': '/api/v1/checkout',
  'auth-svc': '/api/v1/auth',
  cart: '/api/v1/cart',
  recommendations: '/api/v1/recommendations',
  'orders-svc': '/api/v1/orders',
  'redis-cache': '/cache/session',
  inventory: '/api/v1/inventory',
  'payments-svc': '/api/v1/payments',
  'payments-db': '/sql/ledger',
  'fraud-svc': '/api/v1/fraud/check',
  'warehouse-db': '/sql/inventory',
  'notification-svc': '/api/v1/notifications',
  'kafka-broker': '/events/notifications',
};

export class ClusterSimulator {
  private tickCount: number = 0;
  private isRunning: boolean = false;
  private intervalTimer: ReturnType<typeof setInterval> | null = null;
  private subscribers: Set<SnapshotSubscriber> = new Set();

  // Active Incident State
  private activeIncident: IncidentState | null = null;
  private mitigationAppliedAtTick: number | null = null;
  private mitigationSources = new Map<ServiceId, NodeTelemetry>();
  private mitigationAuditTitle: string | null = null;

  // Circular ring buffers storing up to 60 seconds of history per service
  private historyBuffers: Map<ServiceId, CircularRingBuffer<NodeTelemetry>> = new Map();
  private latestSnapshot: ClusterTelemetrySnapshot | null = null;

  constructor(historyCapacity: number = 60) {
    // Initialize circular buffer for each cluster service
    for (const node of CLUSTER_NODES) {
      this.historyBuffers.set(
        node.id,
        new CircularRingBuffer<NodeTelemetry>(historyCapacity)
      );
    }
  }

  /**
   * Starts the 1Hz telemetry simulation loop.
   */
  start(tickIntervalMs: number = 1000): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Run initial tick immediately if no snapshot yet
    if (!this.latestSnapshot) {
      this.tick();
    }

    this.intervalTimer = setInterval(() => {
      this.tick();
    }, tickIntervalMs);
  }

  /**
   * Stops the running simulation loop.
   */
  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  /**
   * Returns current running status.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Injects a deterministic failure incident.
   */
  injectIncident(scenarioId: ScenarioId): void {
    const config = INCIDENT_CONFIGS[scenarioId];
    if (!config) {
      console.warn(`Unknown incident scenario: ${scenarioId}`);
      return;
    }

    this.activeIncident = {
      scenarioId,
      config,
      startedAtTick: this.tickCount,
      elapsedTicks: 0,
    };
    this.mitigationAppliedAtTick = null;
    this.mitigationSources.clear();
    this.mitigationAuditTitle = null;
  }

  /**
   * Clears any active incident and restores cluster to baseline physics.
   */
  clearIncident(): void {
    this.activeIncident = null;
    this.mitigationAppliedAtTick = null;
    this.mitigationSources.clear();
    this.mitigationAuditTitle = null;
  }

  applyMitigation(strategy: RecoveryStrategy): void {
    if (!this.latestSnapshot || this.mitigationAppliedAtTick !== null) return;
    const targets = new Set<ServiceId>([
      strategy.targetService,
      ...(this.activeIncident?.config.cascadeOrder ?? []),
    ]);
    this.mitigationSources.clear();
    for (const serviceId of targets) {
      const telemetry = this.latestSnapshot.nodes[serviceId];
      if (telemetry) this.mitigationSources.set(serviceId, structuredClone(telemetry));
    }
    this.mitigationAppliedAtTick = this.tickCount;
    this.mitigationAuditTitle = strategy.title;
  }

  getMitigationAppliedAtTick(): number | null {
    return this.mitigationAppliedAtTick;
  }

  getMitigationActive(): boolean {
    return this.mitigationAppliedAtTick !== null;
  }

  /**
   * Returns current active incident if any.
   */
  getActiveIncident(): IncidentState | null {
    return this.activeIncident;
  }

  /**
   * Advances the simulation by 1 tick and generates real-time telemetry.
   */
  tick(): ClusterTelemetrySnapshot {
    this.tickCount++;
    const now = Date.now();

    const nodeTelemetries: Record<ServiceId, NodeTelemetry> = {} as Record<
      ServiceId,
      NodeTelemetry
    >;

    // 1. Generate node telemetry vectors with baseline noise
    for (const node of CLUSTER_NODES) {
      nodeTelemetries[node.id] = this.generateNodeTelemetry(node, now);
    }

    // 2. Generate edge telemetry vectors based on caller & target traffic
    const edgeTelemetries: Record<string, EdgeTelemetry> = {};
    for (const edge of CLUSTER_EDGES) {
      const targetTelemetry = nodeTelemetries[edge.target];
      const sourceTelemetry = nodeTelemetries[edge.source];

      const latencyMs = Math.max(
        1,
        Math.round((targetTelemetry?.metrics.p99Ms ?? 20) * 0.85 + Math.random() * 3)
      );
      const sourceDependencies = CLUSTER_NODE_MAP[edge.source].dependencies.length;
      const sourceRps = sourceTelemetry?.metrics.rps ?? 100;
      const qps = Math.max(
        1,
        Math.round(
          (sourceRps / Math.max(1, sourceDependencies)) *
            (0.9 + Math.random() * 0.2)
        )
      );
      const errorRate = targetTelemetry?.metrics.errorRatePct ?? 0.01;
      const saturationScore = Number(
        Math.min(1, Math.max(0, qps / Math.max(1, sourceRps))).toFixed(2)
      );

      edgeTelemetries[edge.id] = {
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        latencyMs,
        qps,
        errorRatePct: errorRate,
        saturationScore,
      };
    }

    // 3. Apply active incident mutations if chaos has been detonated
    if (this.activeIncident && this.mitigationAppliedAtTick === null) {
      this.activeIncident.elapsedTicks++;
      const mutations = calculateIncidentMutations(
        this.activeIncident.scenarioId,
        this.activeIncident.elapsedTicks,
        nodeTelemetries,
        now
      );

      // Mutate node telemetry
      for (const [svcId, nodeMut] of Object.entries(mutations.nodeMutations)) {
        const serviceId = svcId as ServiceId;
        if (nodeTelemetries[serviceId] && nodeMut) {
          nodeTelemetries[serviceId] = {
            ...nodeTelemetries[serviceId],
            ...nodeMut,
            metrics: {
              ...nodeTelemetries[serviceId].metrics,
              ...(nodeMut.metrics ?? {}),
            },
          };
        }
      }

      // Mutate edge telemetry
      for (const [edgeId, edgeMut] of Object.entries(mutations.edgeMutations)) {
        if (edgeTelemetries[edgeId] && edgeMut) {
          edgeTelemetries[edgeId] = {
            ...edgeTelemetries[edgeId],
            ...edgeMut,
          };
        }
      }

      // Apply status overrides
      for (const [svcId, status] of Object.entries(mutations.statusOverrides)) {
        const serviceId = svcId as ServiceId;
        if (nodeTelemetries[serviceId] && status) {
          nodeTelemetries[serviceId].status = status;
        }
      }

      // Append incident logs
      for (const [svcId, logs] of Object.entries(mutations.additionalLogs)) {
        const serviceId = svcId as ServiceId;
        if (nodeTelemetries[serviceId] && logs.length > 0) {
          nodeTelemetries[serviceId].recentLogs = [
            ...logs,
            ...nodeTelemetries[serviceId].recentLogs,
          ].slice(0, 5);
        }
      }
    }

    if (this.mitigationAppliedAtTick !== null) {
      this.applyRecoveryPhysics(nodeTelemetries, now);
    }

    // 4. Push final mutated vectors into circular ring buffers
    for (const node of CLUSTER_NODES) {
      const buffer = this.historyBuffers.get(node.id);
      if (buffer) {
        buffer.push(nodeTelemetries[node.id]);
      }
    }

    // 5. Determine cluster global status
    let globalStatus: ServiceStatus = 'HEALTHY';
    for (const telemetry of Object.values(nodeTelemetries)) {
      if (telemetry.status === 'DEAD' || telemetry.status === 'CRITICAL') {
        globalStatus = 'CRITICAL';
        break;
      } else if (telemetry.status === 'DEGRADED') {
        globalStatus = 'DEGRADED';
      }
    }

    const snapshot: ClusterTelemetrySnapshot = {
      tick: this.tickCount,
      timestamp: now,
      globalStatus,
      activeIncidentId: this.activeIncident?.scenarioId ?? null,
      nodes: nodeTelemetries,
      edges: edgeTelemetries,
    };

    this.latestSnapshot = snapshot;

    // Notify all active subscribers
    for (const sub of this.subscribers) {
      try {
        sub(snapshot);
      } catch (err) {
        console.error('Error in telemetry subscriber callback:', err);
      }
    }

    return snapshot;
  }

  /**
   * Generates a single node's telemetry metrics and log buffer.
   */
  private generateNodeTelemetry(node: TopologyNode, timestamp: number): NodeTelemetry {
    const baselines = node.baselines;

    const cpuPct = generateBaselineMetric(baselines.cpuPct, 0.08, 4.0, 96.0);
    const memPct = generateBaselineMetric(baselines.memPct, 0.03, 10.0, 95.0);
    const p99Ms = generateLatencyMetric(baselines.p99Ms, 0.12, 1);
    const rps = Math.round(generateBaselineMetric(baselines.rps, 0.06, 5, 8000));
    const errorRatePct = generateBaselineMetric(0.02, 0.4, 0.0, 0.15);
    const threadPoolQueueDepth = Math.max(0, Math.round(gaussianRandom(1.5, 1.0)));
    const connectionPoolUtilization = Number(
      Math.min(0.95, Math.max(0.12, gaussianRandom(0.24, 0.04))).toFixed(2)
    );

    const path = REQUEST_PATHS[node.id] || '/healthz';
    const recentLogs: LogEntry[] = [
      {
        level: 'INFO' as const,
        message: `${node.name} PASS ${path} - p99=${p99Ms}ms, cpu=${cpuPct}%`,
        timestamp,
      },
    ];

    if (Math.random() < 0.25) {
      recentLogs.unshift({
        level: 'INFO',
        message: `HTTP 200 OK ${path} handled in ${Math.round(p99Ms * 0.4)}ms`,
        timestamp: timestamp - 400,
      });
    }

    return {
      serviceId: node.id,
      timestamp,
      status: 'HEALTHY',
      metrics: {
        cpuPct,
        memPct,
        p99Ms,
        rps,
        errorRatePct,
        threadPoolQueueDepth,
        connectionPoolUtilization,
      },
      recentLogs,
    };
  }

  private applyRecoveryPhysics(
    nodes: Record<ServiceId, NodeTelemetry>,
    timestamp: number
  ): void {
    if (this.mitigationAppliedAtTick === null) return;
    const elapsedTicks = Math.max(1, this.tickCount - this.mitigationAppliedAtTick);
    const decay = Math.exp(-0.85 * elapsedTicks);

    for (const [serviceId, degraded] of this.mitigationSources) {
      const node = CLUSTER_NODE_MAP[serviceId];
      const current = nodes[serviceId];
      if (!current) continue;
      const recovered = (value: number, baseline: number) =>
        baseline + (value - baseline) * decay;
      current.metrics = {
        ...current.metrics,
        p99Ms: Math.max(1, Math.round(recovered(degraded.metrics.p99Ms, node.baselines.p99Ms))),
        cpuPct: recovered(degraded.metrics.cpuPct, node.baselines.cpuPct),
        memPct: recovered(degraded.metrics.memPct, node.baselines.memPct),
        errorRatePct: recovered(degraded.metrics.errorRatePct, 0.02),
        connectionPoolUtilization: recovered(degraded.metrics.connectionPoolUtilization, 0.22),
        threadPoolQueueDepth: Math.max(
          0,
          Math.round(degraded.metrics.threadPoolQueueDepth * decay)
        ),
      };
      current.status = decay < 0.08 ? 'HEALTHY' : 'DEGRADED';
      if (this.mitigationAuditTitle) {
        current.recentLogs = [
          {
            level: 'INFO' as const,
            message: `[AUDIT] SRE Operator executed ${this.mitigationAuditTitle}. Physics stabilizing.`,
            timestamp,
          },
          ...current.recentLogs,
        ].slice(0, 8);
      }
    }
    this.mitigationAuditTitle = null;
  }

  /**
   * Subscribes a listener to receive real-time snapshots.
   */
  subscribe(callback: SnapshotSubscriber): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Returns chronological telemetry history for a given service.
   */
  getServiceHistory(serviceId: ServiceId): NodeTelemetry[] {
    const buffer = this.historyBuffers.get(serviceId);
    return buffer ? buffer.toArray() : [];
  }

  /**
   * Returns the most recent snapshot emitted by the simulator.
   */
  getLatestSnapshot(): ClusterTelemetrySnapshot | null {
    return this.latestSnapshot;
  }

  /**
   * Returns the current tick count.
   */
  getTick(): number {
    return this.tickCount;
  }

  /**
   * Resets simulation clock, clears incidents and ring buffers.
   */
  reset(): void {
    this.tickCount = 0;
    this.activeIncident = null;
    this.mitigationAppliedAtTick = null;
    this.mitigationSources.clear();
    this.mitigationAuditTitle = null;
    this.latestSnapshot = null;
    for (const buffer of this.historyBuffers.values()) {
      buffer.clear();
    }
  }
}

// Global singleton instance for app-wide telemetry synchronization
let globalSimulatorInstance: ClusterSimulator | null = null;

export function getClusterSimulator(): ClusterSimulator {
  if (!globalSimulatorInstance) {
    globalSimulatorInstance = new ClusterSimulator(60);
  }
  return globalSimulatorInstance;
}
