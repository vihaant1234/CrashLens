/**
 * CrashLens OpenRouter Key Rotator — Type Contracts
 * Prompt 09: Autonomous 3-key failover pool management.
 */

/** Represents a single OpenRouter API key slot in the rotator pool. */
export interface KeySlot {
  /** 1, 2, or 3 */
  id: number;
  /** The raw API key string (never logged) */
  key: string;
  status: 'READY' | 'COOLDOWN' | 'EXHAUSTED';
  /** Epoch millis — key is unavailable until this timestamp */
  cooldownUntil: number;
  totalRequests: number;
  failureCount: number;
  lastError?: string;
}

/** Point-in-time snapshot of the rotator's overall pool state. */
export interface RotatorStatus {
  activeSlotId: number;
  readyKeysCount: number;
  allKeysExhausted: boolean;
  slots: KeySlot[];
}

export interface PublicKeySlot {
  id: number;
  status: KeySlot['status'];
  cooldownUntil: number;
  totalRequests: number;
  failureCount: number;
}

export interface PublicRotatorStatus {
  activeSlotId: number;
  readyKeysCount: number;
  allKeysExhausted: boolean;
  slots: PublicKeySlot[];
}

/** Result envelope returned by executeWithRetry */
export interface RotatorResult<T> {
  data: T | null;
  usedSlotId: number;
  fallbackTriggered: boolean;
  error?: string;
}
