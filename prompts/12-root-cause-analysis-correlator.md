Read AGENTS.md first and follow it strictly.

# Prompt 12: Root Cause Correlator, Blast Radius Highlighting & Countdown HUD

## Objective
Implement the Root Cause Analysis (RCA) Correlator that fuses System 1 model predictions with live topology coordinates, rendering glowing CAD wireframe brackets around the culprit node, tracing downstream cascade arrows, and displaying a live "Time-To-Critical" countdown HUD.

## Negative Constraints
- **Do not implement the 1-click mitigation mutator yet** (only visualize the alert and countdown).
- **Do not clutter the SVG canvas with unreadable text overlays**; use clean monospace calipers and high-contrast alert badges.
- Ensure the countdown timer ticks down smoothly every second.

## Step-by-Step Instructions

1. **Build the RCA Alert Banner Component (`src/components/radar/RcaAlertBanner.tsx`)**:
   - Fixed top overlay above the radar canvas (appears when `anomalyDetected === true`):
     - Left: Blinking amber warning shield + Anomaly tag: `[PRE-FAILURE DETECTED // CONFIDENCE: 94%]`.
     - Center: Root Cause Summary: `CULPRIT: payments-db | MODE: DB_CONNECTION_POOL_LEAK | BLAST RADIUS: 3 SERVICES`.
     - Right: Prominent Time-To-Critical Countdown timer:
       ```
       ⚡ SLA COLLAPSE IN: 00:18s
       ```
     - Background: `rgba(255, 133, 57, 0.12)` with 1px amber border `rgba(255, 133, 57, 0.4)`.

2. **Render Culprit CAD Crosshairs & Brackets in SVG Canvas (`src/components/radar/CulpritCrosshair.tsx`)**:
   - For the identified `rootCauseService`:
     - Render corner CAD brackets around the node card:
       - Top-left `┌`, Top-right `┐`, Bottom-left `└`, Bottom-right `┘`.
     - Color: Pulsing amber `#ff8539` with glowing shadow `filter: drop-shadow(0 0 8px rgba(255, 133, 57, 0.8))`.
     - Coordinates badge: Monospace coordinate label `[CULPRIT: 140, 680]`.

3. **Highlight Downstream Cascade Path**:
   - For every edge connecting the root cause to downstream nodes in `blastRadiusServices`:
     - Increase edge stroke width to `3px`.
     - Apply amber-dashed animated stroke: `stroke-dasharray="6, 4"`.
     - Set edge status to `ALERT_CASCADE`.

4. **Integrate with Zustand State (`src/stores/usePredictionStore.ts`)**:
   - Create `usePredictionStore` holding:
     - `activePrediction: PredictionResult | null`
     - `timeToCriticalRemaining: number`
     - `isAnalyzing: boolean`
     - `lastInferenceDurationMs: number`
   - Decrement `timeToCriticalRemaining` every second while an anomaly is active.

## Documentation Injection
(Here paste CSS animation keyframes for pulsing borders and drop-shadow glow filters)

## Visual Grounding
Refer to the RCA alert HUD in `@prompt_material/12-rca-countdown-hud.png`:
```
+-----------------------------------------------------------------------------------+
| ⚠ PREDICTED FAILURE: payments-db (94% CONFIDENCE)   |   ⚡ SLA BREACH IN: 00:18s   |
| Failure Mode: DB_CONNECTION_POOL_LEAK               |   Downstream: payments, orders|
+-----------------------------------------------------------------------------------+
                                  [ api-gateway ] (vulnerable)
                                   /      |
                        [ orders-svc ] (vulnerable)
                             /
                    [ payments-svc ] (degraded)
                           /
                    ┌─────────────┐
                    │ payments-db │ <=== [CULPRIT: 140, 680] (Amber Glowing Brackets)
                    └─────────────┘
```

## Verification
- Trigger Scenario A (`DB_POOL_LEAK`).
- Confirm the RCA Alert Banner slides down into view with the correct culprit name.
- Confirm the countdown timer counts down (`18s`, `17s`, `16s`...).
- Confirm `payments-db` is framed by glowing amber CAD brackets on the topology canvas.
