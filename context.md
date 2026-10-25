# context.md — CrashLens System Context & Domain Specification

> **Event**: ORCATHON 2026  
> **Track**: Track 01 — Software & AI (Autonomous self-healing systems, reliability intelligence)  
> **Target Project**: CrashLens (Predictive Failure Radar & Distributed Chaos Sandbox)

---

## 🏛️ 1. Problem Statement & Mission

Modern distributed microservice systems operate under complex, opaque dependency graphs. When a subtle performance degradation begins (such as a database connection leak or thread pool saturation), existing observability tools (DataDog, Grafana, CloudWatch) only trigger alerts **after SLAs have breached** or after error thresholds cross 5%—by which point cascading failures have already knocked down upstream services.

**CrashLens** shifts the paradigm from **reactive alerting** to **predictive pre-failure interception**:
1. It continuously maps telemetry vectors (p99 latency, RPS, CPU, memory, thread pool queue depth) across a 12-node topology.
2. It uses **Tier 0 Deterministic Graph Percolation** to track anomaly velocity along dependency edges.
3. It dispatches compact telemetry diffs to **Tier 1 System 1 Reflexive Decision Models** (`inception/mercury-decide:free`, `liquid/lfm-2.5-2.6b:free` via OpenRouter) to diagnose root causes in < 350ms.
4. It arms SREs with a 1-click **Mitigation Mutator** (circuit breaking, load shedding, cache fallbacks) and provides an interactive **Saved vs. Crashed** counterfactual split-screen timeline proving catastrophe was averted.

---

## 🕸️ 2. The 12-Service Microservice Topology

The cluster models a tier-1 e-commerce platform with 12 interconnected microservices structured as a Directed Acyclic Graph (DAG) with edge dependencies:

```
                      [ api-gateway ]
                       /     |      \
                      v      v       v
               [ auth-svc ] [ cart ] [ recommendations ]
                             |   \
                             v    v
               [ orders-svc ]    [ redis-cache ]
                /           \            \
               v             v            v
        [ payments-svc ]  [ inventory ]   [ analytics-svc ]
           /         \           |
          v           v          v
   [ payments-db ] [ fraud-svc ] [ warehouse-db ]
          \
           v
   [ notification-svc ] -> [ kafka-broker ]
```

### Node Directory & Normal Baselines

The canonical implementation topology contains exactly 12 services and 14 edges. To resolve the conflicting draft lists, it omits the leaf `auth-svc` from the ID list and the stale `analytics-svc` reference because it has no service row or baseline. The canonical graph includes a direct `api-gateway` to `orders-svc` route and retains the `payments-db` to `notification-svc` edge shown in the diagram.

| Service ID | Display Name | Role | Downstream Dependencies | Baseline p99 | Baseline CPU | Normal RPS |
|---|---|---|---|---|---|---|
| `api-gateway` | API Gateway | Ingress routing, TLS, auth proxy | `cart`, `recommendations`, `orders-svc` | 18ms | 18% | 1,200 |
| `cart` | Cart & Session | Active user sessions, item staging | `orders-svc`, `redis-cache` | 24ms | 25% | 620 |
| `recommendations` | Recommendations | ML ranker, personalization | `redis-cache` | 65ms | 40% | 310 |
| `orders-svc` | Order Processing | Checkout orchestration, saga coordinator | `payments-svc`, `inventory`, `notification-svc`| 42ms | 30% | 180 |
| `redis-cache` | Distributed Cache | Session store & item cache | none (infrastructure) | 2ms | 15% | 2,400 |
| `inventory` | Inventory Management | Stock reservation, catalog check | `warehouse-db` | 28ms | 28% | 380 |
| `payments-svc` | Payments Engine | Card processing, billing, ledger | `payments-db`, `fraud-svc` | 55ms | 35% | 140 |
| `payments-db` | Payments Database | PostgreSQL ledger, ACID transactions | `notification-svc` | 14ms | 20% | 140 |
| `fraud-svc` | Fraud Detection | Risk scoring, velocity checks | none (leaf) | 38ms | 45% | 140 |
| `warehouse-db` | Warehouse Storage | MySQL inventory counts | none (database leaf) | 16ms | 22% | 380 |
| `notification-svc`| Notifications | Email/SMS receipts | `kafka-broker` | 32ms | 18% | 120 |
| `kafka-broker` | Event Stream | Distributed log queue | none (infrastructure) | 4ms | 12% | 900 |

---

## 📊 3. High-Frequency Telemetry Vector Schema

Every second ($T = 1.0\text{s}$ tick), the cluster simulator emits two structured payloads:

### 3.1 Node Telemetry Payload
```typescript
interface NodeTelemetry {
  serviceId: string;
  timestamp: number;              // Epoch millis
  status: "HEALTHY" | "DEGRADED" | "CRITICAL" | "DEAD";
  metrics: {
    cpuPct: number;               // 0.0 - 100.0%
    memPct: number;               // 0.0 - 100.0%
    p99Ms: number;                // 99th percentile latency in ms
    rps: number;                  // Requests per second
    errorRatePct: number;         // 0.00% - 100.00%
    threadPoolQueueDepth: number; // Queued pending tasks (0 - 500)
    connectionPoolUtilization: number; // Active conns / Max conns (0.0 - 1.0)
  };
  recentLogs: Array<{
    level: "INFO" | "WARN" | "ERROR" | "FATAL";
    message: string;
    timestamp: number;
  }>;
}
```

### 3.2 Edge Telemetry Payload
```typescript
interface EdgeTelemetry {
  source: string;                 // e.g. "orders-svc"
  target: string;                 // e.g. "payments-svc"
  latencyMs: number;              // Edge network + downstream response time
  qps: number;                    // Queries per second across edge
  errorRatePct: number;           // Failed calls along this edge
  saturationScore: number;        // 0.0 - 1.0 (traffic vs capacity)
}
```

---

## 💥 4. The 4 Deterministic Incident Scenarios

CrashLens includes 4 reproducible chaos injection scenarios that follow exact mathematical degradation curves:

### Scenario A: PostgreSQL Connection Pool Leak (`payments-db`)
- **Trigger**: Detonated manually or at $T=15\text{s}$.
- **Root Cause**: Unclosed database connections inside `payments-db` transactional loop.
- **Degradation Formula**:
  $$\text{ConnPool}(t) = \min\left(1.0, 0.20 + 0.035 \times (t - t_0)^{1.4}\right)$$
  $$\text{p99}_{\text{payments-db}}(t) = 14\text{ms} + 450\text{ms} \times \left(\text{ConnPool}(t)\right)^3$$
- **Cascade Sequence**:
  1. $T+0\text{s}$: `payments-db` connection pool utilization starts creeping (20% -> 60%).
  2. $T+12\text{s}$: `payments-svc` threads block waiting for connections; p99 jumps from 55ms to 850ms.
  3. $T+20\text{s}$: `orders-svc` queue fills up to 100% capacity; begins throwing `HTTP 504 Gateway Timeout`.
  4. $T+32\text{s}$: `api-gateway` thread pool starves; global cluster error rate hits 68%.

### Scenario B: Cache Invalidation Stampede (`redis-cache`)
- **Trigger**: Hot-key TTL expiration on product catalog staging.
- **Root Cause**: Sudden drop in cache hit ratio from 98.4% to 12.1%.
- **Cascade Sequence**: Massive 8x query surge slams `inventory` and `warehouse-db`, driving `warehouse-db` CPU to 100% and stalling cart checkout.

### Scenario C: Cryptographic Thread Pool Starvation (`auth-svc`)
- **Trigger**: Heavy burst of bcrypt token re-hashing requests.
- **Root Cause**: CPU-bound cryptographic operations saturate event loop threads.
- **Cascade Sequence**: Latency climbs from 12ms to 2,400ms. `api-gateway` holds open thousands of keep-alive sockets, exhausting file descriptors and dropping ingress connections.

### Scenario D: Exponential Backoff Retry Storm (`notification-svc`)
- **Trigger**: Transient network partition between `notification-svc` and `kafka-broker`.
- **Root Cause**: Missing jitter and aggressive 10x retries cause queue amplification.
- **Cascade Sequence**: `orders-svc` blocked on synchronous notification delivery, causing memory heap overflow in `orders-svc`.

---

## ⚡ 5. System 1 Reflexive Decision Model Specification

System 1 models are fast-reflex architectures trained/tuned for instant classification, structured extraction, and tactical action execution.

### Selected Models
1. **Inception Mercury** (`inception/mercury-decide:free`): Specialized for discrete system decisions, low latency (~200ms), deterministic JSON grammar.
2. **Liquid AI LFM** (`liquid/lfm-2.5-2.6b:free`): Linear Recurrent Neural Network / Liquid state architecture, ultra-fast token generation (~150ms).

### Prompt Engineering Template (Vector to JSON)
```
You are the CrashLens System 1 Reflex Engine. Analyze the following microservice telemetry diff and topology state.
Immediately identify if an anomaly exists, isolate the single root cause node, trace the downstream blast radius, and choose the optimal recovery action.

Respond ONLY with valid parseable JSON conforming to:
{
  "anomalyDetected": boolean,
  "confidence": number,
  "rootCauseService": string,
  "failureMode": string,
  "timeToCriticalSec": number,
  "blastRadiusServices": string[],
  "recommendedAction": {
    "actionId": string,
    "title": string,
    "targetService": string,
    "parameters": Record<string, any>,
    "estimatedRiskReductionPct": number
  }
}

TELEMETRY_DIFF:
{{compactTelemetryVector}}
```

---

## 🔄 6. The 3 OpenRouter API Key Failover Protocol

To ensure 100% uptime during live hackathon presentations, CrashLens uses an autonomous key rotator that operates over a 3-key pool:

```
[Key 1: OPENROUTER_API_KEY_1] ---> (Active)
         |
         +--> [429 Rate Limit / 5xx Error]
         |
         v
[Key 2: OPENROUTER_API_KEY_2] ---> (Failover 1)
         |
         +--> [429 Rate Limit / 5xx Error]
         |
         v
[Key 3: OPENROUTER_API_KEY_3] ---> (Failover 2)
         |
         +--> [All 3 Cooled Down]
         |
         v
[Tier 0 Local Heuristic Z-Score Engine] (Zero-Failure Fallback)
```

- Each key tracks `failureCount`, `lastUsedAt`, and `cooldownExpiresAt`.
- On HTTP 429, the offending key is quarantined for 60 seconds.
- If all 3 keys are quarantined, the **Tier 0 Deterministic Engine** instantly takes over analysis so the UI never stutters.

---

## 🛡️ 7. Recovery Strategies & The Active Mutator

The user can click `[APPLY MITIGATION]` to execute any of 5 pre-engineered mitigation strategies:
1. `CIRCUIT_BREAKER_TRIP`: Instantly trips circuit on offending edge; serves graceful fallback responses.
2. `CONNECTION_POOL_RECYCLE`: Cleans leaked connections and allocates 50 additional pool slots.
3. `ADAPTIVE_RATE_SHEDDING`: Sheds non-essential traffic (recommendations, analytics) to preserve core checkout.
4. `STALE_CACHE_FALLBACK`: Forces read from local stale cache while backend datastore recovers.
5. `THREAD_BULKHEAD_ISOLATION`: Allocates isolated worker thread pools to quarantine stuck cryptography tasks.

---

## 🏆 8. Orcathon Judge Rubric & 3-Minute Demo Script

| Rubric Dimension | How CrashLens Wins Top Score |
|---|---|
| **Technical Innovation (35%)** | Dual-tier architecture combining Tier 0 DAG percolation with System 1 Inception/Liquid models; 3-key autonomous failover. |
| **System Reliability (25%)** | Zero-crash fallback guarantee; handles API outages gracefully without breaking UI. |
| **UX & Visual Polish (20%)** | Noir CAD aesthetics, glowing blast-radius edge pulses, live SVG topology, and zero-layout-shift UI. |
| **Demonstrable Impact (20%)** | The "Saved vs. Crashed" split timeline directly visualizes the counterfactual reality of preventing a $250k downtime incident. |
