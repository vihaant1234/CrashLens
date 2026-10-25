Read AGENTS.md first and follow it strictly.

# Prompt 06: Incident Injector Engine & 4 Deterministic Chaos Scenarios

## Objective
Implement the deterministic Chaos & Incident Injector engine that allows developers and judges to detonate 4 reproducible cascading failure scenarios, modifying telemetry vectors in real time according to mathematical degradation curves.

## Negative Constraints
- **Do not write the AI prediction or OpenRouter logic yet** (let the failure propagate unmitigated).
- **Do not build the full recovery advisor yet** (only simulate the failure physics).
- Ensure that degradation curves are completely deterministic so demonstrations behave consistently every time.

## Step-by-Step Instructions

1. **Define Incident Interfaces (`src/types/incidents.ts`)**:
   ```typescript
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
   ```

2. **Implement the Mathematical Incident Curves (`src/engine/simulator/incidentScenarios.ts`)**:
   Program the exact formulas from `context.md` Section 4:
   - **Scenario A: PostgreSQL Connection Pool Leak (`payments-db`)**:
     - At $t_0$, `payments-db` connection pool begins leaking:
       $$\text{poolUtil}(t) = \min(1.0, 0.20 + 0.035 \times (t - t_0)^{1.4})$$
     - Latency scales cubically: $\text{p99} = 14 + 450 \times (\text{poolUtil})^3\text{ ms}$.
     - When $\text{poolUtil} > 0.85$, propagate delay to `payments-svc` ($\text{p99} \to 850\text{ms}$).
     - When $t - t_0 > 20\text{s}$, `orders-svc` queue hits 100% and throws 504 Gateway Timeouts.
     - When $t - t_0 > 32\text{s}$, `api-gateway` thread pool starves (cluster error rate $\to 68\%$).
   - **Scenario B: Cache Invalidation Stampede (`redis-cache`)**:
     - Cache hit ratio drops from 98.4% to 12.1%.
     - 8x query surge hits `inventory` and `warehouse-db`, driving CPU to 100%.
   - **Scenario C: Cryptographic Thread Pool Starvation (`auth-svc`)**:
     - Event loop blocks; latency climbs from 12ms to 2,400ms.
     - `api-gateway` file descriptors exhaust, dropping ingress connections.
   - **Scenario D: Exponential Backoff Retry Storm (`notification-svc`)**:
     - Downstream failure without jitter creates queue amplification, causing memory leak in `orders-svc`.

3. **Integrate Incident Injector into `ClusterSimulator`**:
   - Add methods to `ClusterSimulator`:
     - `injectIncident(scenarioId: ScenarioId): void`
     - `clearIncident(): void`
     - `getActiveIncident(): IncidentState | null`
   - During `simulator.tick()`, if an incident is active, apply the degradation curve mutations over baseline metrics.

4. **Build the Detonate Chaos Menu in `SimulationDock`**:
   - Add a dropdown button: `[ ⚠ INJECT CHAOS ]`
   - List the 4 scenarios with descriptive subtext (e.g., *"Scenario A: DB Pool Leak on payments-db"*).
   - Selecting a scenario starts the failure propagation immediately.
   - Add an `[ABORT / CLEAR CHAOS]` button to restore baseline health.

## Documentation Injection
(Here paste math/physics modeling patterns for cascading microservice failures)

## Verification
- Click `[ ⚠ INJECT CHAOS ] -> Scenario A: DB Pool Leak`.
- Watch the simulation clock: at $T+0\text{s}$, `payments-db` latency rises; at $T+12\text{s}$, `payments-svc` degrades; at $T+20\text{s}$, `orders-svc` errors climb; at $T+32\text{s}$, global cluster errors spike.
- Click `[CLEAR CHAOS]`: confirm cluster recovers to baseline healthy status.
