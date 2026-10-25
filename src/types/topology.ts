/**
 * CrashLens topology contracts.
 *
 * Prompt 01 — strongly typed schema models for the cluster described in
 * context.md Section 2.
 */

/** Canonical service identifiers across the cluster DAG. */
export type ServiceId =
  | "api-gateway"
  | "auth-svc"
  | "cart"
  | "recommendations"
  | "orders-svc"
  | "redis-cache"
  | "inventory"
  | "payments-svc"
  | "payments-db"
  | "fraud-svc"
  | "warehouse-db"
  | "notification-svc"
  | "kafka-broker";

/** Functional classification of a service inside the topology. */
export type ServiceRole =
  | "gateway"
  | "auth"
  | "core-logic"
  | "cache"
  | "database"
  | "queue"
  | "auxiliary";

/** Lifecycle status of a node under simulation load. */
export type ServiceStatus = "HEALTHY" | "DEGRADED" | "CRITICAL" | "DEAD";

/** Normal-operation reference values used for anomaly detection baselines. */
export interface ServiceBaselines {
  p99Ms: number;
  cpuPct: number;
  memPct: number;
  rps: number;
}

/** A node of the 12-service DAG rendered on the radar canvas. */
export interface TopologyNode {
  id: ServiceId;
  name: string;
  role: ServiceRole;
  /** 0: Ingress, 1: Edge proxies, 2: Core apps, 3: Datastores & Queues. */
  tier: number;
  /** SVG canvas normalized X coordinate (0-1000). */
  x: number;
  /** SVG canvas normalized Y coordinate (0-1000). */
  y: number;
  /** Downstream dependencies of this service. */
  dependencies: ServiceId[];
  baselines: ServiceBaselines;
}

/** How much the cluster depends on a given call path. */
export type EdgeCriticality = "CRITICAL" | "HIGH" | "LOW";

/** A directed dependency edge between two services. */
export interface TopologyEdge {
  /** e.g. `'orders-svc->payments-svc'` */
  id: string;
  source: ServiceId;
  target: ServiceId;
  criticality: EdgeCriticality;
}
