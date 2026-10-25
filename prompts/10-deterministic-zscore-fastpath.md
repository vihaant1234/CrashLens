Read AGENTS.md first and follow it strictly.

# Prompt 10: Tier 0 Deterministic Fast-Path: Z-Score Anomaly & DAG Percolation

## Objective
Build the Tier 0 local deterministic prediction engine that computes rolling Z-scores, anomaly velocity, and topological graph percolation in < 5ms per tick. This serves as the instant pre-filter for System 1 AI calls and the fail-safe fallback when API keys are cooled down.

## Negative Constraints
- **Do not write the OpenRouter LLM calling code in this step** (keep this engine 100% self-contained and local).
- **Do not introduce heavy statistical packages**; implement lean mathematical algorithms in pure TypeScript.
- Ensure execution takes < 5ms per 1Hz tick so the main simulation loop stays silky smooth.

## Step-by-Step Instructions

1. **Implement Rolling Statistics (`src/engine/analysis/rollingStats.ts`)**:
   - Function `computeRollingZScore(currentVal: number, history: number[]): number`:
     - Calculate sample mean: $\mu = \frac{1}{N}\sum x_i$
     - Calculate sample standard deviation: $\sigma = \sqrt{\frac{1}{N}\sum (x_i - \mu)^2}$
     - Return:
       $$Z = \frac{\text{currentVal} - \mu}{\sigma + \epsilon}$$
     - Bound $Z$ to range $[-3.0, 15.0]$.

2. **Build Anomaly Score & Velocity Estimator (`src/engine/analysis/AnomalyDetector.ts`)**:
   - `class AnomalyDetector`:
     - Computes composite anomaly score $S_{\text{anomaly}}$ for each service:
       $$S_{\text{anomaly}} = 0.50 \times Z_{\text{p99}} + 0.30 \times Z_{\text{errorRate}} + 0.20 \times Z_{\text{cpu}}$$
     - If $S_{\text{anomaly}} > 2.5$, mark node as anomalous.
     - Calculates Anomaly Velocity:
       $$V_{\text{anomaly}} = \frac{S_{\text{anomaly}}(t) - S_{\text{anomaly}}(t-3)}{3\text{ seconds}}$$
     - Computes estimated `timeToCriticalSec`:
       $$\text{TTC} = \max\left(5, \frac{10.0 - S_{\text{anomaly}}}{V_{\text{anomaly}} + \epsilon}\right)$$

3. **Implement DAG Topological Percolation (`src/engine/analysis/DagPercolation.ts`)**:
   - Using the adjacency matrix from `CLUSTER_EDGES`:
   - Identify candidate root cause node: the node with the earliest anomaly onset timestamp and highest ratio of outgoing downstream degradation.
   - Breadth-First Search (BFS) / Topological sweep from root cause:
     - Trace all downstream dependent nodes reachable via directed edges.
     - Assign vulnerable probability based on edge criticality and caller degradation.
     - Return `blastRadiusServices: ServiceId[]`.

4. **Package Tier 0 Local Prediction Result (`src/types/prediction.ts`)**:
   - Export structured format matching the System 1 schema:
     ```typescript
     export interface PredictionResult {
       source: 'SYSTEM_1_AI' | 'TIER_0_LOCAL_DETERMINISTIC';
       anomalyDetected: boolean;
       confidence: number;
       rootCauseService: ServiceId | null;
       failureMode: string;
       timeToCriticalSec: number;
       blastRadiusServices: ServiceId[];
       recommendedAction: {
         actionId: string;
         title: string;
         targetService: ServiceId;
         parameters: Record<string, any>;
         estimatedRiskReductionPct: number;
       };
     }
     ```

## Documentation Injection
(Here paste TypeScript algorithms for DAG traversal and running standard deviation)

## Verification
- In a test script, feed baseline metrics: confirm `anomalyDetected` is `false`.
- Feed Scenario A metrics: confirm `payments-db` is isolated as root cause with $Z > 4.0$ and blast radius includes `payments-svc` and `orders-svc` within < 2ms execution time.
