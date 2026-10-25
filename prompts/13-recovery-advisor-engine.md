Read AGENTS.md first and follow it strictly.

# Prompt 13: AI Recovery Advisor & Strategy Recommendation Cards

## Objective
Construct the AI Recovery Advisor panel that translates System 1 diagnoses into 3 prioritized, actionable mitigation strategies with estimated risk reduction percentages, blast radius shrink projections, and 1-click execution triggers.

## Negative Constraints
- **Do not execute the mutation logic in this step** (keep the buttons wired to an action dispatcher stub).
- **Do not produce generic or vague suggestions** (e.g. "Check the logs"); provide concrete, engineering-grade actions (e.g., "Recycle connection pool & expand limit to 100").
- Focus strictly on strategy generation, ranking logic, tradeoff explanations, and card UI design.

## Step-by-Step Instructions

1. **Define Recovery Action Interfaces (`src/types/recovery.ts`)**:
   ```typescript
   export type ActionType = 
     | 'CIRCUIT_BREAKER_TRIP' 
     | 'CONNECTION_POOL_RECYCLE' 
     | 'ADAPTIVE_RATE_SHEDDING' 
     | 'STALE_CACHE_FALLBACK' 
     | 'THREAD_BULKHEAD_ISOLATION';

   export interface RecoveryStrategy {
     id: string;
     actionType: ActionType;
     title: string;
     targetService: ServiceId;
     isRecommended: boolean;
     estimatedRiskReductionPct: number;    // e.g. 85%
     estimatedTimeToRecoverSec: number;     // e.g. 3s
     tradeoff: string;                      // Plain language engineering tradeoff
     parameters: Record<string, any>;
   }
   ```

2. **Implement Strategy Generation Matrix (`src/engine/analysis/recoveryStrategies.ts`)**:
   Map the 4 failure scenarios to concrete mitigation options:
   - For `DB_POOL_LEAK` (`payments-db`):
     - **Option 1 (Recommended)**: `CONNECTION_POOL_RECYCLE` (Terminates leaked idle transactions, sets pool ceiling to 100 conns. Risk reduction: 88%. Tradeoff: Zero user-facing drop).
     - **Option 2 (Defensive)**: `CIRCUIT_BREAKER_TRIP` on `payments-svc` (Fails fast at 250ms threshold. Risk reduction: 65%. Tradeoff: 10% card payment retries).
     - **Option 3 (Aggressive)**: `ADAPTIVE_RATE_SHEDDING` (Drops cart recommendations and analytics traffic by 50%. Risk reduction: 45%).
   - Implement corresponding 3-tier strategies for `CACHE_STAMPEDE`, `THREAD_STARVATION`, and `RETRY_STORM`.

3. **Build the Recovery Advisor Panel Component (`src/components/advisor/RecoveryAdvisorPanel.tsx`)**:
   - Location: Integrated into the right-hand side rail or as a sliding bottom drawer.
   - Header: `AI RECOVERY ADVISOR` with Inception Mercury badge `[SYSTEM 1 - REFLEX ACTION]`.
   - Card List:
     - Recommended Card: Highlighted with an amber-glowing border (`border-accent-amber/60`) and `[RECOMMENDED]` badge.
     - Metric Row: Risk Reduction bar (gradient green/amber bar showing `88%`), Recovery ETA (`~3s`).
     - Tradeoff Text: Monospace caption explaining system impact.
     - Action Button: Prominent amber button `[APPLY THIS MITIGATION ⚡]`.
     - Secondary Cards: Two alternative mitigation options with lower risk reduction scores.

4. **Wire Advisor to `usePredictionStore`**:
   - When `activePrediction` updates, automatically populate the 3 recovery strategies.

## Documentation Injection
(Here paste SRE site reliability engineering patterns for automated runbooks and circuit breakers)

## Visual Grounding
Refer to the strategy cards in `@prompt_material/13-recovery-advisor-cards.png`:
```
+-------------------------------------------------------+
| AI RECOVERY ADVISOR                   [ SYS 1 MERCURY ]|
| 3 Strategies evaluated for payments-db pool leak      |
+-------------------------------------------------------+
| ★ RECOMMENDED STRATEGY                                 |
| Recycle Connection Pool & Shed Idle Leaks             |
| Target: payments-db  |  Recovery ETA: ~3s             |
| Risk Reduction: [██████████████████░░░] 88%           |
| Tradeoff: Terminates 14 leaked transactions. Zero user|
|           drop. Core saga restored immediately.       |
|                                                       |
|             [ ⚡ APPLY MITIGATION NOW ]                |
+-------------------------------------------------------+
| ALTERNATIVE 2: Trip Circuit Breaker on payments-svc   |
| Risk Reduction: [████████████░░░░░░░░] 65%            |
+-------------------------------------------------------+
| ALTERNATIVE 3: Adaptive Rate Shedding on Cart Traffic  |
| Risk Reduction: [████████░░░░░░░░░░░░] 45%            |
+-------------------------------------------------------+
```

## Verification
- Trigger Scenario A: verify that 3 ranked recovery strategies appear in the advisor panel.
- Confirm that the recommended strategy highlights with the highest risk reduction percentage (88%).
