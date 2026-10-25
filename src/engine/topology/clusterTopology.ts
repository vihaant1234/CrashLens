/**
 * Canonical CrashLens Cluster Topology
 * Topologically structured DAG with assigned coordinates, roles, and normal operating baselines.
 * Includes all 13 microservices and 14 dependency edges.
 */

import type { TopologyNode, TopologyEdge, ServiceId } from '@/types/topology';

export const SERVICE_IDS: readonly ServiceId[] = [
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
] as const;

export const CLUSTER_NODES: TopologyNode[] = [
  {
    id: 'api-gateway',
    name: 'API Gateway',
    role: 'gateway',
    tier: 0,
    x: 500,
    y: 80,
    dependencies: ['auth-svc', 'cart', 'recommendations'],
    baselines: {
      p99Ms: 18,
      cpuPct: 18,
      memPct: 35,
      rps: 1200,
    },
  },
  {
    id: 'auth-svc',
    name: 'Authentication Svc',
    role: 'auth',
    tier: 1,
    x: 240,
    y: 220,
    dependencies: [],
    baselines: {
      p99Ms: 12,
      cpuPct: 22,
      memPct: 28,
      rps: 850,
    },
  },
  {
    id: 'cart',
    name: 'Cart & Session',
    role: 'core-logic',
    tier: 1,
    x: 500,
    y: 220,
    dependencies: ['orders-svc', 'redis-cache', 'inventory'],
    baselines: {
      p99Ms: 24,
      cpuPct: 25,
      memPct: 40,
      rps: 620,
    },
  },
  {
    id: 'recommendations',
    name: 'Recommendations',
    role: 'auxiliary',
    tier: 1,
    x: 760,
    y: 220,
    dependencies: ['redis-cache'],
    baselines: {
      p99Ms: 65,
      cpuPct: 40,
      memPct: 55,
      rps: 310,
    },
  },
  {
    id: 'orders-svc',
    name: 'Order Processing',
    role: 'core-logic',
    tier: 2,
    x: 360,
    y: 380,
    dependencies: ['payments-svc', 'inventory', 'notification-svc'],
    baselines: {
      p99Ms: 42,
      cpuPct: 30,
      memPct: 45,
      rps: 180,
    },
  },
  {
    id: 'redis-cache',
    name: 'Distributed Cache',
    role: 'cache',
    tier: 2,
    x: 640,
    y: 380,
    dependencies: [],
    baselines: {
      p99Ms: 2,
      cpuPct: 15,
      memPct: 60,
      rps: 2400,
    },
  },
  {
    id: 'payments-svc',
    name: 'Payments Engine',
    role: 'core-logic',
    tier: 3,
    x: 220,
    y: 520,
    dependencies: ['payments-db', 'fraud-svc'],
    baselines: {
      p99Ms: 55,
      cpuPct: 35,
      memPct: 42,
      rps: 140,
    },
  },
  {
    id: 'inventory',
    name: 'Inventory Management',
    role: 'core-logic',
    tier: 3,
    x: 460,
    y: 520,
    dependencies: ['warehouse-db'],
    baselines: {
      p99Ms: 28,
      cpuPct: 28,
      memPct: 38,
      rps: 380,
    },
  },
  {
    id: 'notification-svc',
    name: 'Notifications',
    role: 'auxiliary',
    tier: 3,
    x: 700,
    y: 520,
    dependencies: ['kafka-broker'],
    baselines: {
      p99Ms: 32,
      cpuPct: 18,
      memPct: 30,
      rps: 120,
    },
  },
  {
    id: 'payments-db',
    name: 'Payments Database',
    role: 'database',
    tier: 4,
    x: 140,
    y: 680,
    dependencies: [],
    baselines: {
      p99Ms: 14,
      cpuPct: 20,
      memPct: 50,
      rps: 140,
    },
  },
  {
    id: 'fraud-svc',
    name: 'Fraud Detection',
    role: 'auxiliary',
    tier: 4,
    x: 300,
    y: 680,
    dependencies: [],
    baselines: {
      p99Ms: 38,
      cpuPct: 45,
      memPct: 48,
      rps: 140,
    },
  },
  {
    id: 'warehouse-db',
    name: 'Warehouse Storage',
    role: 'database',
    tier: 4,
    x: 520,
    y: 680,
    dependencies: [],
    baselines: {
      p99Ms: 16,
      cpuPct: 22,
      memPct: 45,
      rps: 380,
    },
  },
  {
    id: 'kafka-broker',
    name: 'Event Stream',
    role: 'queue',
    tier: 4,
    x: 760,
    y: 680,
    dependencies: [],
    baselines: {
      p99Ms: 4,
      cpuPct: 12,
      memPct: 40,
      rps: 900,
    },
  },
];

export const CLUSTER_EDGES: TopologyEdge[] = [
  {
    id: 'api-gateway->auth-svc',
    source: 'api-gateway',
    target: 'auth-svc',
    criticality: 'HIGH',
  },
  {
    id: 'api-gateway->cart',
    source: 'api-gateway',
    target: 'cart',
    criticality: 'CRITICAL',
  },
  {
    id: 'api-gateway->recommendations',
    source: 'api-gateway',
    target: 'recommendations',
    criticality: 'LOW',
  },
  {
    id: 'cart->orders-svc',
    source: 'cart',
    target: 'orders-svc',
    criticality: 'CRITICAL',
  },
  {
    id: 'cart->redis-cache',
    source: 'cart',
    target: 'redis-cache',
    criticality: 'HIGH',
  },
  {
    id: 'cart->inventory',
    source: 'cart',
    target: 'inventory',
    criticality: 'HIGH',
  },
  {
    id: 'recommendations->redis-cache',
    source: 'recommendations',
    target: 'redis-cache',
    criticality: 'LOW',
  },
  {
    id: 'orders-svc->payments-svc',
    source: 'orders-svc',
    target: 'payments-svc',
    criticality: 'CRITICAL',
  },
  {
    id: 'orders-svc->inventory',
    source: 'orders-svc',
    target: 'inventory',
    criticality: 'CRITICAL',
  },
  {
    id: 'orders-svc->notification-svc',
    source: 'orders-svc',
    target: 'notification-svc',
    criticality: 'LOW',
  },
  {
    id: 'payments-svc->payments-db',
    source: 'payments-svc',
    target: 'payments-db',
    criticality: 'CRITICAL',
  },
  {
    id: 'payments-svc->fraud-svc',
    source: 'payments-svc',
    target: 'fraud-svc',
    criticality: 'HIGH',
  },
  {
    id: 'inventory->warehouse-db',
    source: 'inventory',
    target: 'warehouse-db',
    criticality: 'CRITICAL',
  },
  {
    id: 'notification-svc->kafka-broker',
    source: 'notification-svc',
    target: 'kafka-broker',
    criticality: 'LOW',
  },
];

// Quick index lookups for high-performance rendering & graph percolation
export const CLUSTER_NODE_MAP: Record<ServiceId, TopologyNode> = Object.freeze(
  Object.fromEntries(CLUSTER_NODES.map((node) => [node.id, node])) as Record<
    ServiceId,
    TopologyNode
  >
);
export const NODE_BY_ID = CLUSTER_NODE_MAP;

export const CLUSTER_EDGE_MAP: Record<string, TopologyEdge> = Object.freeze(
  Object.fromEntries(CLUSTER_EDGES.map((edge) => [edge.id, edge])) as Record<
    string,
    TopologyEdge
  >
);
export const EDGE_BY_ID = CLUSTER_EDGE_MAP;

/**
 * Returns downstream services called directly by the specified service.
 */
export function getDownstreamDependencies(serviceId: ServiceId): ServiceId[] {
  return CLUSTER_NODE_MAP[serviceId]?.dependencies ?? [];
}

/**
 * Returns upstream services that call the specified service.
 */
export function getUpstreamCallers(serviceId: ServiceId): ServiceId[] {
  return CLUSTER_EDGES.filter((edge) => edge.target === serviceId).map(
    (edge) => edge.source
  );
}
