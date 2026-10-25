Read AGENTS.md first and follow it strictly.

# Prompt 14: The Mitigation Mutator: Live Physics Remediation & Recovery Feedback

## Objective
Implement the Mitigation Mutator action handler that executes the selected recovery strategy, actively altering the simulation engine's physics in real time to stabilize degraded metrics, drain queues, clear error rates, and render celebratory "System Saved" visual feedback.

## Negative Constraints
- **Do not snap metrics instantaneously to zero**; apply a realistic exponential recovery decay over 3 to 4 seconds to visually demonstrate the self-healing process.
- **Do not wipe out historical sparkline trends**; the recovery curve must be preserved in the ring buffer.
- Ensure the user gets immediate tactile feedback upon clicking the button (sound/haptic/pulse).

## Step-by-Step Instructions

1. **Implement Recovery Mutation Physics in `ClusterSimulator`**:
   - Add method `applyMitigation(strategy: RecoveryStrategy): void`:
     - Sets `mitigationActive = true`.
     - Records `mitigationAppliedAtTick = currentTick`.
     - In the subsequent tick loop, applies exponential recovery formula:
       $$\text{metric}(t) = \text{baseline} + (\text{degradedValue} - \text{baseline}) \times e^{-k \cdot (t - t_{\text{applied}})}$$
       where $k = 0.85$ (causes 90% recovery within 3 ticks).
     - Drains thread pool queues back to 0.
     - Resets connection pool utilization to healthy baseline ($0.22$).
     - Injects green audit log entry: `[AUDIT] SRE Operator executed ${strategy.title}. Physics stabilizing.`

2. **Update Visual Canvas State on Mitigation**:
   - Culprit Node Brackets: Transition color from warning amber (`#ff8539`) to calm emerald green (`#22c55e`).
   - SVG Edge Waves: Red packet drops clear; normal cyan packet flows resume across downstream edges.
   - Blast Radius Ripple: Dissipates and stops pulsing.

3. **Update RCA Banner to Success State (`RcaAlertBanner.tsx`)**:
   - Replace countdown timer with success badge:
     ```
     ✓ SYSTEM SAVED — RECOVERY APPLIED AT T+14s
     Global Error Rate: 0.02% | p99 Restored: 18ms
     ```
   - Color shifts to soothing green glass `rgba(34, 197, 94, 0.15)` with emerald border.

4. **Connect Advisor Button**:
   - Wire `[ ⚡ APPLY MITIGATION NOW ]` to call `applyMitigation(recommendedStrategy)`.
   - Add tactile button animation (`active:scale-95`, glowing border sweep).

## Documentation Injection
(Here paste exponential decay easing algorithms for smooth metric transitions)

## Verification
- Trigger Scenario A (`DB_POOL_LEAK`).
- Wait until $T+12\text{s}$ when latency is high and countdown shows `~00:15s`.
- Click `[ ⚡ APPLY MITIGATION NOW ]`.
- Watch the radar: verify that `payments-db` latency decays from 842ms down to 18ms over the next 3 seconds, queues drain, and the banner turns green with `✓ SYSTEM SAVED`.
