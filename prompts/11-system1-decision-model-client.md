Read AGENTS.md first and follow it strictly.

# Prompt 11: System 1 Decision Model Client: Mercury & Liquid via OpenRouter

## Objective
Build the Tier 1 System 1 AI Decision Client that queries ultra-fast reflexive models (`inception/mercury-decide:free` and `liquid/lfm-2.5-2.6b:free`) through OpenRouter, backed by the 3-key rotator, returning structured JSON root-cause diagnoses in < 350ms.

## Negative Constraints
- **Do not send massive bloated telemetry payloads to the LLM**; distill the 12-node cluster into a compact 10-line telemetry diff vector (< 300 tokens) to ensure sub-350ms response latency.
- **Do not let model hallucination crash the UI**; always validate and sanitize the JSON schema before returning.
- If OpenRouter fails on all 3 keys, seamlessly fall back to Tier 0 local deterministic analysis without throwing errors.

## Step-by-Step Instructions

1. **Implement Compact Telemetry Vector Serializer (`src/engine/ai/compactSerializer.ts`)**:
   - Write a function `serializeTelemetryDiff(snapshot: ClusterTelemetrySnapshot, zScores: Map<ServiceId, number>): string`:
     - Filters for nodes where $|Z| > 1.5$ or status $\neq \text{'HEALTHY'}$.
     - Outputs a high-density, token-efficient table format:
       ```
       NODE           P99(MS)  ERR%   CPU%   CONN%  QUEUE  Z-SCORE
       payments-db    842      14.2   88     98     14     +4.82 (ANOMALY)
       payments-svc   420      8.1    72     45     28     +2.65 (LAG)
       orders-svc     180      2.4    54     20     8      +1.75 (BUFFER)
       ```
     - Appends 3 most recent error log snippets.

2. **Construct System 1 Prompt Generator (`src/engine/ai/system1Prompts.ts`)**:
   - Construct the system and user messages optimized for Inception Mercury / Liquid LFM:
     ```
     You are the CrashLens System 1 Reflex Engine. You decide failure root causes and recovery actions instantly.
     Rules:
     1. Analyze the telemetry diff and graph topology.
     2. Identify if an anomaly exists.
     3. Select the SINGLE root cause node.
     4. Enumerate downstream blast radius nodes.
     5. Choose the optimal recovery action.
     6. Output MUST be ONLY valid JSON conforming to the schema. Zero conversational prose.
     ```

3. **Build the OpenRouter Inference Client (`src/engine/ai/System1Client.ts`)**:
   - `class System1Client`:
     - Constructor accepts `OpenRouterKeyRotator` instance.
     - Model candidates:
       - Primary: `inception/mercury-decide:free`
       - Secondary: `liquid/lfm-2.5-2.6b:free`
     - Method `analyzeCluster(snapshot: ClusterTelemetrySnapshot): Promise<PredictionResult>`:
       - 1. Run Tier 0 local detector first.
       - 2. If no anomaly detected ($Z < 2.0$), return healthy result immediately without consuming OpenRouter tokens.
       - 3. If anomaly detected, build compact prompt and invoke `rotator.executeWithRetry`:
         - Send POST request to `https://openrouter.ai/api/v1/chat/completions` with headers:
           - `Authorization: Bearer ${apiKey}`
           - `HTTP-Referer: https://orcathon.crashlens.dev`
           - `X-Title: CrashLens SRE Radar`
         - Parameters: `temperature: 0.1`, `max_tokens: 300`, `response_format: { type: "json_object" }`.
       - 4. Parse response body, extract JSON, and validate required fields.
       - 5. If rotator indicates fallback or if JSON parse fails, return Tier 0 prediction result with `source: 'TIER_0_LOCAL_DETERMINISTIC'`.

4. **Add Live Health & Latency Telemetry**:
   - Record AI inference round-trip time (e.g. `245ms`).
   - Store latency and model source in Zustand store for display in the header status bar.

## Documentation Injection
(Here paste OpenRouter Chat Completions API documentation for free model endpoints)

## Verification
- Test with simulated DB pool leak data.
- Confirm System 1 returns valid JSON identifying `payments-db` as root cause in < 400ms.
- Test with an invalid/exhausted API key: confirm automatic fallback to Tier 0 local deterministic prediction without error.
