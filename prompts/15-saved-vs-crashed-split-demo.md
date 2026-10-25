Read AGENTS.md first and follow it strictly.

# Prompt 15: The "Saved vs. Crashed" Split-Screen Counterfactual Timeline

## Objective
Build the signature hackathon demo feature: an interactive side-by-side "Saved vs. Crashed" split-screen timeline comparison that contrasts the mitigated system against the unmitigated counterfactual catastrophe, giving judges and SREs undeniable proof of failure prevention.

## Negative Constraints
- **Do not make this a static non-interactive image or modal**; build an interactive dual-timeline scrubber where dragging the time slider shows both states diverging.
- Ensure the counterfactual simulation uses the mathematical unmitigated curves from `context.md` Section 4.
- Make the contrast stark, visual, and immediately legible within 5 seconds of glance.

## Step-by-Step Instructions

1. **Implement Counterfactual Simulation Buffer (`src/engine/simulator/counterfactualModel.ts`)**:
   - Write a function `generateCounterfactualPair(incidentId: ScenarioId, durationTicks: number = 45)`:
     - Generates two synchronized arrays of 45 snapshots:
       - **Array A (Mitigated)**: Scenario starts at $t_0$, mitigation applied at $T+14\text{s}$, returns to baseline by $T+18\text{s}$.
       - **Array B (Unmitigated)**: Scenario runs without mitigation; cascade propagates to `orders-svc` at $T+20\text{s}$, hits `api-gateway` at $T+32\text{s}$, cluster crashes with 94% errors by $T+40\text{s}$.
     - Computes comparative business impact metrics:
       - Dropped transactions: `4 vs. 1,420`
       - SLA Downtime: `0s vs. 182s`
       - Estimated Revenue at Risk: `$240 vs. $184,000`.

2. **Construct Split-Screen Viewer Component (`src/components/comparison/SavedVsCrashedViewer.tsx`)**:
   - Fullscreen or modal drawer with dual-pane layout:
   - **Left Pane (Emerald Glow // "SAVED WITH CRASHLENS")**:
     - Mini topology canvas or summary metrics card.
     - Live metric sparkline showing quick recovery peak and flatline to 0.02% error rate.
     - Banner: `[PRE-FAILURE DETECTED AT T+12s // MITIGATION APPLIED AT T+14s // SLA PROTECTED]`.
   - **Right Pane (Blood-Red Warning // "CRASHED WITHOUT CRASHLENS")**:
     - Mini topology canvas or summary metrics card.
     - Live metric sparkline showing exponential spike to 94% error rate and cluster blackout.
     - Banner: `[FIRST HUMAN ALERT AT T+28s // GATEWAY BLACKOUT AT T+34s // SLA VIOLATED]`.

3. **Build Interactive Timeline Scrubber (`TimelineScrubber.tsx`)**:
   - Horizontal scrub bar (`T+00s` to `T+45s`) at the bottom of the modal:
     - Play / Pause / Replay buttons.
     - Scrub handle that synchronizes both panes simultaneously.
     - Milestone flags:
       - `T+12s`: System 1 Anomaly Flagged
       - `T+14s`: 1-Click Mitigation Executed
       - `T+28s`: Traditional PagerDuty Alert Triggered (Too Late)
       - `T+34s`: Full Gateway Starvation

4. **Add Launch Trigger to `RadarHeader`**:
   - Add a prominent badge button: `[ ⚖ SAVED VS CRASHED TIMELINE ]`.
   - Automatically reveal this modal after a mitigation action is successfully completed.

## Documentation Injection
(Here paste React dual-range timeline scrubber and SVG synchronized sparkline patterns)

## Visual Grounding
Refer to the split-screen design in `@prompt_material/15-saved-vs-crashed.png`:
```
+-----------------------------------------------------------------------------------+
|               CRASHLENS COUNTERFACTUAL VERIFICATION ENGINE                        |
+-----------------------------------------+-----------------------------------------+
| ✓ SAVED WITH CRASHLENS (PREDICTIVE)     | ✕ CRASHED WITHOUT CRASHLENS (REACTIVE)  |
| Mode: Inception Mercury System 1        | Mode: Reactive PagerDuty Alerting       |
| Status: STABILIZED IN 4 SECONDS         | Status: TOTAL CLUSTER OUTAGE AT T+34s   |
+-----------------------------------------+-----------------------------------------+
| Error Rate: 0.02%  (SLA Intact)         | Error Rate: 94.2%  (SLA Breached)       |
| Lost Checkouts: 4 ($240 impact)         | Lost Checkouts: 1,420 ($184k loss)      |
| Latency Sparkline:                      | Latency Sparkline:                      |
|    _/\_---------------- 18ms baseline   |    _/\__/\/\/\/\/\██████ 3,400ms (OOM)  |
+-----------------------------------------+-----------------------------------------+
| SCRUBBER: [====================●==========================] T+18s / T+45s         |
|           T+12s (AI Flag)   T+14s (Applied)   T+28s (PagerDuty)  T+34s (Dead)     |
+-----------------------------------------------------------------------------------+
```

## Verification
- Click `[ ⚖ SAVED VS CRASHED TIMELINE ]`.
- Scrub the slider to $T+14\text{s}$: confirm both panes show the initial pool leak.
- Scrub to $T+20\text{s}$: confirm the Left pane shows recovery, while the Right pane shows orders-svc failing.
- Scrub to $T+35\text{s}$: confirm the Right pane shows full cluster blackout.
