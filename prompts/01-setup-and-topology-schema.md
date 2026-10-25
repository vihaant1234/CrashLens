Read AGENTS.md first and follow it strictly.

# Prompt 01: Setup, Directory Scaffolding & 12-Service Topology Schemas

## Objective
Initialize the CrashLens TypeScript project structure, install essential dependencies, and construct the strongly-typed schema models representing the 12-service microservice cluster and telemetry vectors.

## Negative Constraints
- **Do not write the simulation engine or tick loop yet.**
- **Do not build any React components or UI screens yet.**
- **Do not configure OpenRouter or AI decision models in this step.**
- Focus purely on project configuration, directory scaffolding, and TypeScript data contracts.

## Step-by-Step Instructions

1. **Verify & Configure Project Scaffolding**:
   - Ensure the Next.js 15 (App Router) + TypeScript environment is ready with Tailwind CSS.
   - Install required utility libraries:
     ```bash
     npm install zustand lucide-react clsx tailwind-merge
     ```
   - Ensure `tsconfig.json` has `strict: true` and path alias `"@/*": ["./src/*"]`.

2. **Create Core Type Definitions (`src/types/topology.ts`)**:
   Define the 12 microservices and their dependency graph structure:
   - `ServiceId`: Union type of `'api-gateway' | 'cart' | 'recommendations' | 'orders-svc' | 'redis-cache' | 'inventory' | 'payments-svc' | 'payments-db' | 'fraud-svc' | 'warehouse-db' | 'notification-svc' | 'kafka-broker'`.
   - `ServiceRole`: `'gateway' | 'auth' | 'core-logic' | 'cache' | 'database' | 'queue' | 'auxiliary'`.
   - `ServiceStatus`: `'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DEAD'`.
   - `TopologyNode`:
     - `id: ServiceId`
     - `name: string`
     - `role: ServiceRole`
     - `tier: number` (0: Ingress, 1: Edge proxies, 2: Core apps, 3: Datastores & Queues)
     - `x: number`, `y: number` (SVG canvas normalized coordinates, 0-1000)
     - `dependencies: ServiceId[]` (downstream services)
     - `baselines: { p99Ms: number, cpuPct: number, memPct: number, rps: number }`
   - `TopologyEdge`:
     - `id: string` (e.g. `'orders-svc->payments-svc'`)
     - `source: ServiceId`
     - `target: ServiceId`
     - `criticality: 'CRITICAL' | 'HIGH' | 'LOW'`

3. **Create Telemetry Contracts (`src/types/telemetry.ts`)**:
   Define the high-frequency 1Hz telemetry data contracts:
   - `NodeTelemetry`:
     - `serviceId: ServiceId`
     - `timestamp: number`
     - `status: ServiceStatus`
     - `metrics: { cpuPct, memPct, p99Ms, rps, errorRatePct, threadPoolQueueDepth, connectionPoolUtilization }`
     - `recentLogs: Array<{ level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL', message: string, timestamp: number }>`
   - `EdgeTelemetry`:
     - `edgeId: string`
     - `source: ServiceId`
     - `target: ServiceId`
     - `latencyMs: number`
     - `qps: number`
     - `errorRatePct: number`
     - `saturationScore: number` (0.0 to 1.0)
   - `ClusterTelemetrySnapshot`:
     - `tick: number`
     - `timestamp: number`
     - `globalStatus: ServiceStatus`
     - `activeIncidentId: string | null`
     - `nodes: Record<ServiceId, NodeTelemetry>`
     - `edges: Record<string, EdgeTelemetry>`

4. **Define the Canonical 12-Service Topology Constant (`src/engine/topology/clusterTopology.ts`)**:
   Export `CLUSTER_NODES: TopologyNode[]` and `CLUSTER_EDGES: TopologyEdge[]` matching the exact specifications in `context.md` Section 2.
   - Resolve the source documents' conflicting service lists using the canonical 12-service, 14-edge topology documented in `context.md`; keep the API Gateway at `x: 500, y: 100` and databases/brokers at `y: 750`.

## Documentation Injection
(Here paste the latest Next.js 15 TypeScript configuration and Zustand store typing guidelines if needed)

## Verification
- Run `npx tsc --noEmit` and confirm 0 errors.
- Ensure all 12 services and 14 edges are accurately typed and exported.
