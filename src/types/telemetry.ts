/**
 * CrashLens 1Hz telemetry contracts.
 *
 * Prompt 01 — data shapes emitted by the cluster simulator every tick.
 * (The simulator itself is built in Prompt 02.)
 */

import type { ServiceId, ServiceStatus } from "@/types/topology";

/** Severity levels emitted by service log streams. */
export type LogLevel = "INFO" | "WARN" | "ERROR" | "FATAL";

/** A single log line attached to a node's telemetry payload. */
export interface TelemetryLog {
  level: LogLevel;
  message: string;
  /** Epoch millis */
  timestamp: number;
}

export type LogEntry = TelemetryLog;

/** The full metric vector emitted by one service per tick. */
export interface NodeMetrics {
  /** 0.0 - 100.0% */
  cpuPct: number;
  /** 0.0 - 100.0% */
  memPct: number;
  /** 99th percentile latency in ms */
  p99Ms: number;
  /** Requests per second */
  rps: number;
  /** 0.00% - 100.00% */
  errorRatePct: number;
  /** Queued pending tasks (0 - 500) */
  threadPoolQueueDepth: number;
  /** Active conns / Max conns (0.0 - 1.0) */
  connectionPoolUtilization: number;
}

/** Per-node payload emitted on every 1Hz tick. */
export interface NodeTelemetry {
  serviceId: ServiceId;
  /** Epoch millis */
  timestamp: number;
  status: ServiceStatus;
  metrics: NodeMetrics;
  recentLogs: TelemetryLog[];
}

/** Per-edge payload emitted on every 1Hz tick. */
export interface EdgeTelemetry {
  edgeId: string;
  source: ServiceId;
  target: ServiceId;
  /** Edge network + downstream response time */
  latencyMs: number;
  /** Queries per second across edge */
  qps: number;
  /** Failed calls along this edge */
  errorRatePct: number;
  /** Traffic vs capacity (0.0 to 1.0) */
  saturationScore: number;
}

/** Full cluster state captured at a single simulation tick. */
export interface ClusterTelemetrySnapshot {
  tick: number;
  /** Epoch millis */
  timestamp: number;
  globalStatus: ServiceStatus;
  activeIncidentId: string | null;
  nodes: Record<ServiceId, NodeTelemetry>;
  edges: Record<string, EdgeTelemetry>;
}
