/**
 * CrashLens OpenRouter 3-Key Failover Rotator
 *
 * Manages a pool of 3 OpenRouter API keys with automatic rotation on HTTP 429 /
 * 5xx errors, per-key cooldown timers, and graceful fallback signaling when all
 * keys are exhausted.
 *
 * Prompt 09 implementation — no AI inference prompts yet.
 */

import type { KeySlot, PublicRotatorStatus, RotatorStatus, RotatorResult } from './rotatorTypes';

const COOLDOWN_MS = 60_000; // 60 seconds per-key cooldown on 429/5xx
const POOL_SIZE = 3;

export interface KeyRotatorOptions {
  /** Override the 3 API keys (for testing). Falls back to process.env if omitted. */
  keys?: [string, string, string];
  /** Override cooldown duration in ms (default 60_000). */
  cooldownMs?: number;
}

/**
 * Autonomous OpenRouter API Key Rotator.
 *
 * Usage:
 * ```typescript
 * const rotator = new OpenRouterKeyRotator();
 * const result = await rotator.executeWithRetry((apiKey) =>
 *   callOpenRouter(apiKey, prompt)
 * );
 * if (result.fallbackTriggered) {
 *   // use local Tier-0 heuristics
 * }
 * ```
 */
export class OpenRouterKeyRotator {
  private readonly slots: KeySlot[];
  private activeSlotIndex: number = 0;
  private readonly cooldownMs: number;

  constructor(options: KeyRotatorOptions = {}) {
    this.cooldownMs = options.cooldownMs ?? COOLDOWN_MS;

    // Resolve API keys from options or environment variables
    const rawKeys: [string, string, string] = options.keys ?? [
      (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY_1 : undefined) ?? '',
      (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY_2 : undefined) ?? '',
      (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY_3 : undefined) ?? '',
    ];

    this.slots = rawKeys.map((key, i): KeySlot => ({
      id: i + 1,
      key,
      status: key ? 'READY' : 'EXHAUSTED',
      cooldownUntil: 0,
      totalRequests: 0,
      failureCount: 0,
    }));
  }

  // ── Core Key Accessor ─────────────────────────────────────────────────────

  /**
   * Returns the API key for the currently active slot, or null if all keys
   * are in cooldown / exhausted.
   *
   * Automatically resets slots whose cooldown has expired.
   */
  getActiveKey(): string | null {
    this._refreshCooldowns();

    // Attempt each slot starting from the active index
    for (let attempt = 0; attempt < POOL_SIZE; attempt++) {
      const idx = (this.activeSlotIndex + attempt) % POOL_SIZE;
      const slot = this.slots[idx];

      if (slot.status === 'EXHAUSTED') continue;

      if (slot.status === 'COOLDOWN') continue;

      if (slot.status === 'READY' && slot.key) {
        this.activeSlotIndex = idx;
        return slot.key;
      }
    }

    return null; // All keys exhausted or in cooldown
  }

  /**
   * Returns the active slot ID (1-indexed), useful for UI status indicators.
   */
  getActiveSlotId(): number {
    return this.slots[this.activeSlotIndex].id;
  }

  // ── Result Recording ──────────────────────────────────────────────────────

  /**
   * Increments success counter for the specified slot.
   */
  recordSuccess(slotId: number): void {
    const slot = this._slotById(slotId);
    if (!slot) return;
    slot.totalRequests++;
    slot.lastError = undefined;
  }

  /**
   * Marks a key as COOLDOWN on 429 / 5xx errors and rotates to the next slot.
   */
  recordFailure(slotId: number, statusCode: number, errorMessage: string): void {
    const slot = this._slotById(slotId);
    if (!slot) return;

    slot.totalRequests++;
    slot.failureCount++;
    slot.lastError = errorMessage;

    const shouldCooldown = statusCode === 429 || (statusCode >= 500 && statusCode < 600);
    if (shouldCooldown) {
      slot.status = 'COOLDOWN';
      slot.cooldownUntil = Date.now() + this.cooldownMs;
      const cooldownSec = Math.ceil(this.cooldownMs / 1000);
      console.warn(`[KEY_ROTATION: Key ${slotId} -> Cooldown (${cooldownSec}s). Rotating.]`);

      // Advance to next slot
      this.activeSlotIndex = slotId % POOL_SIZE;
    }
  }

  // ── Pool Status ───────────────────────────────────────────────────────────

  /** Returns a snapshot of the full key pool state. */
  getStatus(): RotatorStatus {
    this._refreshCooldowns();

    const activeSlot = this.slots[this.activeSlotIndex];
    if (activeSlot.status !== 'READY') {
      const nextReadyIndex = this.slots.findIndex((slot) => slot.status === 'READY');
      if (nextReadyIndex !== -1) this.activeSlotIndex = nextReadyIndex;
    }

    const slots = this.slots.map((slot) => ({ ...slot }));

    const readyKeysCount = slots.filter((s) => s.status === 'READY' && s.key).length;
    const allKeysExhausted = readyKeysCount === 0;

    return {
      activeSlotId: this.slots[this.activeSlotIndex].id,
      readyKeysCount,
      allKeysExhausted,
      slots,
    };
  }

  getPublicStatus(): PublicRotatorStatus {
    const status = this.getStatus();
    return {
      activeSlotId: status.activeSlotId,
      readyKeysCount: status.readyKeysCount,
      allKeysExhausted: status.allKeysExhausted,
      slots: status.slots.map(({ id, status: slotStatus, cooldownUntil, totalRequests, failureCount }) => ({
        id,
        status: slotStatus,
        cooldownUntil,
        totalRequests,
        failureCount,
      })),
    };
  }

  /**
   * Returns remaining cooldown in seconds for a given slot id, or 0 if ready.
   */
  getCooldownRemainingSec(slotId: number): number {
    this._refreshCooldowns();
    const slot = this._slotById(slotId);
    if (!slot || slot.status !== 'COOLDOWN') return 0;
    return Math.max(0, Math.ceil((slot.cooldownUntil - Date.now()) / 1000));
  }

  // ── Retry Executor ────────────────────────────────────────────────────────

  /**
   * Executes `requestFn` with retry-on-failure semantics across the 3-key pool.
   *
   * - Attempts up to 3 times (one per available key).
   * - Records successes/failures on the correct slot.
   * - Returns `{ data: null, fallbackTriggered: true }` when all keys fail.
   */
  async executeWithRetry<T>(
    requestFn: (apiKey: string) => Promise<T>
  ): Promise<RotatorResult<T>> {
    let lastError = '';

    for (let attempt = 0; attempt < POOL_SIZE; attempt++) {
      const key = this.getActiveKey();

      if (!key) {
        console.error('[AI_ROTATOR_ALL_COOLDOWN_FALLBACK_TO_LOCAL]');
        return { data: null, usedSlotId: -1, fallbackTriggered: true, error: 'All keys exhausted' };
      }

      const slotId = this.getActiveSlotId();

      try {
        const data = await requestFn(key);
        this.recordSuccess(slotId);
        return { data, usedSlotId: slotId, fallbackTriggered: false };
      } catch (err: unknown) {
        const httpStatus = _extractStatus(err);
        lastError = err instanceof Error ? err.message : String(err);

        this.recordFailure(slotId, httpStatus, lastError);

        if (httpStatus !== 429 && httpStatus < 500) {
          // Non-retriable client error (e.g. 400 bad request)
          break;
        }
        // Continue to next key for 429 / 5xx
      }
    }

    console.error('[AI_ROTATOR_ALL_COOLDOWN_FALLBACK_TO_LOCAL]');
    return { data: null, usedSlotId: -1, fallbackTriggered: true, error: lastError };
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _slotById(id: number): KeySlot | undefined {
    return this.slots.find((s) => s.id === id);
  }

  private _refreshCooldowns(): void {
    const now = Date.now();
    for (const slot of this.slots) {
      if (slot.status === 'COOLDOWN' && now >= slot.cooldownUntil) {
        slot.status = 'READY';
        slot.cooldownUntil = 0;
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _extractStatus(err: unknown): number {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e['status'] === 'number') return e['status'];
    if (typeof e['statusCode'] === 'number') return e['statusCode'];
    if (typeof e['code'] === 'number') return e['code'];
  }
  return 0;
}

// ── Global Singleton ──────────────────────────────────────────────────────────

let _globalRotator: OpenRouterKeyRotator | null = null;

export function getKeyRotator(): OpenRouterKeyRotator {
  if (!_globalRotator) {
    _globalRotator = new OpenRouterKeyRotator();
  }
  return _globalRotator;
}
