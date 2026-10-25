# AGENTS.md — CrashLens Engineering & Agent Operating Guidelines

This document governs all architectural, visual, and implementation decisions for agents and developers working on **CrashLens**.

---

## 🎯 1. Project Overview

**CrashLens** is a predictive failure radar and chaos sandbox for distributed microservice architectures. It simulates a 12-node enterprise microservice topology emitting high-frequency 1Hz telemetry, monitors the cluster with a dual-tier prediction engine (Tier 0 deterministic topological percolation + Tier 1 System 1 reflexive decision models via OpenRouter), flags impending failures before SLAs breach, traces cascading blast radius across the dependency graph, pinpoints the root cause, and provides an active 1-click mitigation mutator with a side-by-side "Saved vs. Crashed" validation timeline.

### 🌟 Core Value Proposition
- **Predictive, Not Reactive**: Identifies subtle anomalies (thread pool leaks, memory creep, queue build-up) 15–45 seconds *before* service death.
- **System 1 Reflexive Decisions**: Employs ultra-fast sub-400ms decision models (Inception Mercury / Liquid AI LFMs) for instant classification and mitigation selection without slow multi-step chain-of-thought delays.
- **Fail-Safe 3-Key Rotator**: Automatically rotates through a pool of 3 OpenRouter API keys on HTTP 429 / 5xx, backed by zero-dependency local heuristic fallbacks.
- **Verifiable Proof**: Demonstrates counterfactual simulation where the user can watch the system recover with mitigation vs. collapse without it.

---

## 💻 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Framework** | Next.js 15 (App Router) + React 19 | SSR capability, low-latency client rendering, seamless embedding into Orcathon |
| **Language** | TypeScript 5.x (Strict mode) | Strict type contracts for telemetry vectors, DAG graphs, and System 1 outputs |
| **Styling** | Vanilla CSS + Tailwind CSS (v3.4) | Pitch noir theme (`#07080a`), CAD wireframes, glowing blast-radius pulses |
| **State Management** | Zustand 5.x + Circular Ring Buffers | High-frequency 1Hz state updates without triggering React subtree re-renders |
| **Graph Visualization**| SVG + HTML5 Canvas (dual-layer) | Precise bezier edge animations, glowing particle percolation, zoom/pan |
| **Icons** | Lucide React | Clean, technical, lightweight status and telemetry glyphs |
| **AI Inference** | OpenRouter OpenAI-Compatible SDK | Multi-model routing (`inception/mercury-decide:free`, `liquid/lfm-2.5-2.6b:free`) |
| **Key Rotator** | Custom `OpenRouterKeyRotator` | In-memory key pooling, status tracking, cooldown timers, exponential backoff |
| **Telemetry Simulator**| In-Browser WebWorker / TypeScript Engine | Zero-lag 1Hz simulation clock with deterministic incident scenario curves |

---

## 🧠 3. System 1 Model Decision Layer & Key Failover Protocol

### Why System 1 Models?
In site reliability engineering during active cascading degradation, traditional heavy LLMs (thinking models with 5-15s latency) are unacceptable — by the time the model reasons, the cluster has already collapsed. System 1 models (e.g., Inception Mercury, Liquid AI LFMs) mimic biological fast-reflex instinct:
- **Latencies**: 150ms – 400ms.
- **Token Budget**: Compact prompt (compacted telemetry vector + DAG slice) -> compact JSON response (≤ 150 tokens).
- **Target Models**:
  - `inception/mercury-decide:free` (Optimized for discrete operational actions)
  - `liquid/lfm-2.5-2.6b:free` (Extreme inference throughput, lightweight footprint)

### 3-Key Failover Rotator Contract
```typescript
interface KeyRotatorConfig {
  keys: [string, string, string]; // Exactly 3 OpenRouter API keys
  cooldownMs: number;             // Default 60_000ms on 429
  maxRetriesPerTick: number;      // 3 (one per key)
}
```
1. Requests use `activeKeyIndex`.
2. On HTTP 429 (Rate Limit) or HTTP 5xx:
   - Mark current key with `cooldownUntil = now + cooldownMs`.
   - Increment key index modulo 3.
   - Retry immediately with next available key.
3. If all 3 keys are in cooldown:
   - Fall back instantly to **Tier 0 Local Deterministic Engine** (Z-score + topological graph percolation).
   - Log telemetry warning `[AI_ROTATOR_ALL_COOLDOWN_FALLBACK_TO_LOCAL]`.
   - The user never experiences a broken or frozen UI during hackathon demos.

### Structured JSON Response Contract
System 1 models must strictly return parseable JSON conforming to this schema:
```json
{
  "anomalyDetected": true,
  "confidence": 0.94,
  "rootCauseService": "payments-db",
  "failureMode": "DB_CONNECTION_POOL_LEAK",
  "timeToCriticalSec": 18,
  "blastRadiusServices": ["payments", "orders", "api-gateway"],
  "recommendedAction": {
    "actionId": "RESTART_POOL_AND_SHED",
    "title": "Recycle Connection Pool & Drop Non-Essential Traffic",
    "targetService": "payments-db",
    "parameters": { "dropNonEssentialPct": 50, "poolMaxConnections": 100 },
    "estimatedRiskReductionPct": 82
  }
}
```

---

## 📐 4. Development Philosophy & Non-Negotiable Directives

1. **No White Screen Default**: The visual theme must follow deep pitch noir (`#07080a`, `#0a0b10`), warm cream text (`#ffedd6`), and amber alert wireframes (`#ff8539`).
2. **Zero Layout Shifts (CLS < 0.05)**: All radar panels, sparklines, and metric cards must declare explicit dimensions or aspect ratios.
3. **No Heavy Re-renders on 1Hz Ticks**:
   - High-frequency telemetry streams must be stored in mutable circular ring buffers.
   - Decouple SVG/Canvas rendering loops from React component state where necessary.
4. **Thin, Verifiable Slices**:
   - Every feature must be built and verified step-by-step according to the 16 JS Mastery prompt sequence.
   - No blind monolithic rewrites.
5. **Deterministic Chaos**: All 4 incident scenarios must be mathematically reproducible with predictable ramp-up curves so demos are 100% reliable.

---

## 🏗️ 5. Architectural Directory Layout

```
CrashLense/
├── AGENTS.md                          # This architecture specification
├── context.md                         # Problem statement, topology, telemetry & rubric
├── prompts/                           # 16 sequential JS Mastery prompts
│   ├── 01-setup-and-topology-schema.md
│   ├── 02-telemetry-engine-and-ring-buffer.md
│   ├── 03-design-system-and-radar-shell.md
│   ├── 04-static-topology-svg-graph.md
│   ├── 05-zustand-cluster-state.md
│   ├── 06-incident-injector-engine.md
│   ├── 07-dynamic-radar-motion-and-blast-radius.md
│   ├── 08-service-inspector-drawer.md
│   ├── 09-openrouter-key-rotator.md
│   ├── 10-deterministic-zscore-fastpath.md
│   ├── 11-system1-decision-model-client.md
│   ├── 12-root-cause-analysis-correlator.md
│   ├── 13-recovery-advisor-engine.md
│   ├── 14-mitigation-action-mutator.md
│   ├── 15-saved-vs-crashed-split-demo.md
│   └── 16-orcathon-playground-embed.md
├── src/
│   ├── engine/
│   │   ├── topology/                  # 12-service DAG definitions & edge matrices
│   │   ├── simulator/                 # 1Hz tick loop, noise generator, incident curves
│   │   ├── ai/                        # Key rotator, OpenRouter client, System 1 prompt
│   │   └── analysis/                  # Z-score detector, blast radius percolation, RCA
│   ├── stores/                        # Zustand stores (telemetryStore, incidentStore)
│   ├── components/
│   │   ├── radar/                     # SVG topology graph, glowing edge pulses
│   │   ├── inspector/                 # Node inspector drawer, telemetry sparklines
│   │   ├── advisor/                   # AI recovery cards, 1-click apply mutator
│   │   └── comparison/                # Saved vs. Crashed split-screen playback
│   └── types/                         # TypeScript interfaces (telemetry, topology, ai)
└── prompt_material/                   # Visual wireframes and UI references
```

---

## 🚦 6. Decision-Making Matrix

- **Need visual styling?** Use Tailwind CSS with pre-defined theme tokens (`--bg-pitch`, `--accent-amber`).
- **Need animation?** Use CSS keyframes or lightweight requestAnimationFrame for particle flows; avoid bloated animation bundles.
- **OpenRouter returns 429?** Trigger `OpenRouterKeyRotator.rotate()`; if all fail, switch to local Z-Score heuristics seamlessly.
- **Need to test without API keys?** The simulator and Tier 0 local engine must function completely offline.
