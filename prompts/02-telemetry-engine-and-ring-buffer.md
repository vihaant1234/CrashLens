Read AGENTS.md first and follow it strictly.

# Prompt 02: 1Hz Telemetry Engine & Zero-Allocation Ring Buffer

## Objective
Build the mathematical simulation engine that generates realistic 1Hz telemetry vectors for all 12 microservices, with a zero-allocation circular ring buffer for real-time sparkline metrics without React garbage collection stutter.

## Negative Constraints
- **Do not write the failure incident injection triggers yet** (keep services in normal baseline jitter).
- **Do not build any UI components or SVG radar maps yet.**
- **Do not invoke any external AI APIs or OpenRouter calls.**
- Focus purely on the data-generation mathematics and the ring buffer data structure.

## Step-by-Step Instructions

1. **Implement the Circular Ring Buffer (`src/engine/simulator/RingBuffer.ts`)**:
   Create a generic, performant fixed-capacity circular buffer:
   - `class CircularRingBuffer<T>`:
     - `constructor(capacity: number = 60)` (stores 60 seconds of history).
     - `push(item: T): void` (overwrites oldest entry when full in $O(1)$).
     - `toArray(): T[]` (returns items in chronological order).
     - `latest(): T | undefined`
     - `clear(): void`
   - Ensure memory is allocated once on initialization to avoid garbage collector churn.

2. **Build Gaussian Noise & Metric Generator (`src/engine/simulator/noiseModel.ts`)**:
   Implement realistic telemetry fluctuation:
   - Normal distribution helper `gaussianRandom(mean: number, stdDev: number): number`.
   - Function `generateBaselineMetric(baseline: number, variancePct: number, minVal: number, maxVal: number): number`.
   - Ensure latency has a log-normal tail (rare small spikes even during healthy state).

3. **Construct the Cluster Simulator Core (`src/engine/simulator/ClusterSimulator.ts`)**:
   - `class ClusterSimulator`:
     - Holds in-memory state of all 12 services and 14 edges.
     - Maintains a `Map<ServiceId, CircularRingBuffer<NodeTelemetry>>` storing the last 60 ticks.
     - `start(tickIntervalMs: number = 1000): void`
     - `stop(): void`
     - `tick(): ClusterTelemetrySnapshot`
       - Increments simulation clock.
       - Generates node metrics using baseline values + realistic noise.
       - Generates edge metrics based on upstream and downstream traffic flow.
       - Generates contextual log lines (e.g. `[INFO] GET /api/v1/cart - 200 OK (22ms)`).
     - `subscribe(callback: (snapshot: ClusterTelemetrySnapshot) => void): () => void` (Unsubscribe function).
     - `getServiceHistory(serviceId: ServiceId): NodeTelemetry[]`.

4. **Add Unit Test / Headless Validation Script (`scripts/test-simulator.ts`)**:
   - Run a 5-tick headless simulation loop.
   - Verify that all 12 services emit valid telemetry snapshots and that the ring buffer maintains chronological order.

## Documentation Injection
(Here paste TypeScript performance best practices for in-memory ring buffers and log-normal distributions)

## Verification
- Run `npx tsx scripts/test-simulator.ts` (or run a quick Jest/Vitest test).
- Verify all 12 services emit valid values every second without memory leaks.
