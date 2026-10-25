Read AGENTS.md first and follow it strictly.

# Prompt 09: OpenRouter 3-Key Failover Rotator & Telemetry Circuit Breaker

## Objective
Implement the autonomous `OpenRouterKeyRotator` class that manages a pool of 3 OpenRouter API keys (`OPENROUTER_API_KEY_1`, `OPENROUTER_API_KEY_2`, `OPENROUTER_API_KEY_3`), seamlessly rotating across keys on HTTP 429 rate-limits or 5xx errors with cooldown timers, and signaling fallback when the pool is exhausted.

## Negative Constraints
- **Do not write the System 1 inference prompts or model schemas yet** (focus solely on the key management client).
- **Do not hardcode secret API keys into source code**; read from environment variables or a runtime settings object.
- Never let an API error throw an unhandled exception that stops the simulation or crashes the UI.

## Step-by-Step Instructions

1. **Define Key Rotator Types (`src/engine/ai/rotatorTypes.ts`)**:
   ```typescript
   export interface KeySlot {
     id: number;                   // 1, 2, or 3
     key: string;
     status: 'READY' | 'COOLDOWN' | 'EXHAUSTED';
     cooldownUntil: number;        // Epoch millis
     totalRequests: number;
     failureCount: number;
     lastError?: string;
   }

   export interface RotatorStatus {
     activeSlotId: number;
     readyKeysCount: number;
     allKeysExhausted: boolean;
     slots: KeySlot[];
   }
   ```

2. **Construct the Key Rotator Class (`src/engine/ai/OpenRouterKeyRotator.ts`)**:
   - `class OpenRouterKeyRotator`:
     - Initializes with 3 keys from `process.env` or passed options:
       `[process.env.OPENROUTER_API_KEY_1, process.env.OPENROUTER_API_KEY_2, process.env.OPENROUTER_API_KEY_3]`.
     - Maintains internal array of 3 `KeySlot` objects.
     - `getActiveKey(): string | null`
       - Checks if active slot is in cooldown. If cooldown expired, resets status to `'READY'`.
       - If active slot is cooled down, increments index modulo 3 to find next `'READY'` slot.
       - If no slots are ready, returns `null` (signals all keys exhausted).
     - `recordSuccess(slotId: number): void`
       - Increments `totalRequests`, clears error state.
     - `recordFailure(slotId: number, statusCode: number, errorMessage: string): void`
       - If status code is 429 or 5xx:
         - Marks slot as `'COOLDOWN'` for 60,000ms (`cooldownUntil = Date.now() + 60000`).
         - Increments `failureCount`.
         - Rotates `activeSlotId` to the next slot.
       - Dispatches event `[KEY_ROTATION: Key ${slotId} -> Cooldown (60s). Rotating.]`.
     - `getStatus(): RotatorStatus`
     - `executeWithRetry<T>(requestFn: (apiKey: string) => Promise<T>): Promise<{ data: T | null, usedSlotId: number, fallbackTriggered: boolean }>`
       - Attempts up to 3 times (once per key).
       - If all 3 keys fail, returns `{ data: null, fallbackTriggered: true }` without crashing.

3. **Wire Key Status Indicator to `RadarHeader`**:
   - In the header telemetry bar, render a small key indicator badge:
     - `KEY 1: ACTIVE (Ready)` | `KEY 2: READY` | `KEY 3: READY`
     - If Key 1 hits a 429, update badge to: `KEY 1: COOLDOWN (48s) -> SWITCHED TO KEY 2`.
     - If all 3 fail: badge shows `AI: FALLBACK TO LOCAL ENGINE`.

4. **Add Unit / Mock Test Script (`scripts/test-rotator.ts`)**:
   - Simulate a mocked HTTP 429 response on Key 1.
   - Verify that the rotator immediately invokes Key 2 on the retry.
   - Verify that simulated cooldown expiration restores Key 1 to `'READY'` after the cooldown window.

## Documentation Injection
(Here paste OpenRouter API rate limit headers: x-ratelimit-limit, x-ratelimit-remaining, retry-after)

## Verification
- Run `npx tsx scripts/test-rotator.ts`.
- Confirm rotation from Key 1 -> Key 2 -> Key 3 happens seamlessly on simulated 429s.
- Confirm `fallbackTriggered: true` is returned gracefully when all 3 keys are mocked in cooldown.
