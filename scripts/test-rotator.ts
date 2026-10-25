/**
 * CrashLens — OpenRouter Key Rotator Unit Test Script
 * Run with: npx tsx scripts/test-rotator.ts
 *
 * Validates:
 * 1. Rotation from Key 1 → Key 2 → Key 3 on simulated HTTP 429s.
 * 2. Graceful fallbackTriggered=true when all 3 keys are in cooldown.
 * 3. Cooldown expiration restores a key to READY.
 */

import { OpenRouterKeyRotator } from '../src/engine/ai/OpenRouterKeyRotator';

const PASS = '\x1b[32m✔\x1b[0m';
const FAIL = '\x1b[31m✘\x1b[0m';
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ${PASS}  ${label}`);
    passed++;
  } else {
    console.error(`  ${FAIL}  ${label}`);
    failed++;
  }
}

async function main() {
  // ─── Create a rotator with mock keys and 200ms cooldown (fast for tests) ───
  const rotator = new OpenRouterKeyRotator({
    keys: ['mock-key-1', 'mock-key-2', 'mock-key-3'],
    cooldownMs: 200,
  });

  // ─── TEST 1: Initial state ──────────────────────────────────────────────────
  console.log('\n[TEST 1] Initial pool state:');
  const initial = rotator.getStatus();
  assert(initial.readyKeysCount === 3, 'All 3 keys are READY initially');
  assert(initial.allKeysExhausted === false, 'Pool is not exhausted initially');
  assert(initial.activeSlotId === 1, 'Active slot starts at Key 1');

  // ─── TEST 2: Rotation on HTTP 429 ──────────────────────────────────────────
  console.log('\n[TEST 2] Rotation on simulated HTTP 429s:');
  const attemptedKeys: string[] = [];
  const retryResult = await rotator.executeWithRetry(async (key) => {
    attemptedKeys.push(key);
    if (key === 'mock-key-1' || key === 'mock-key-2') {
      throw Object.assign(new Error('Rate limited'), { status: 429 });
    }
    return 'response-from-key-3';
  });
  assert(attemptedKeys.join(',') === 'mock-key-1,mock-key-2,mock-key-3', 'Retries immediately from Key 1 through Key 2 to Key 3');
  assert(retryResult.data === 'response-from-key-3', 'Returns the successful response from Key 3');
  assert(retryResult.usedSlotId === 3, 'Reports Key 3 as the successful slot');
  assert(rotator.getActiveSlotId() === 3, 'After Key 1 and Key 2 rate limits, active slot = Key 3');

  // ─── TEST 3: All keys exhausted ────────────────────────────────────────────
  console.log('\n[TEST 3] Fallback when all keys exhausted:');
  rotator.recordFailure(3, 429, 'Rate limited');

  const allExhausted = rotator.getStatus();
  assert(allExhausted.readyKeysCount === 0, 'readyKeysCount = 0 when all keys in cooldown');
  assert(allExhausted.allKeysExhausted === true, 'allKeysExhausted = true');

  const noKey = rotator.getActiveKey();
  assert(noKey === null, 'getActiveKey() returns null when pool exhausted');

  // ─── TEST 4: executeWithRetry fallback ────────────────────────────────────
  console.log('\n[TEST 4] executeWithRetry returns fallbackTriggered=true:');
  // Create fresh rotator with all keys pre-cooled
  const rotator2 = new OpenRouterKeyRotator({
    keys: ['k1', 'k2', 'k3'],
    cooldownMs: 60_000, // Long cooldown so they stay in cooldown
  });
  rotator2.recordFailure(1, 429, 'sim');
  rotator2.recordFailure(2, 429, 'sim');
  rotator2.recordFailure(3, 429, 'sim');

  const result = await rotator2.executeWithRetry(async (_key) => {
    throw Object.assign(new Error('429 Too Many Requests'), { status: 429 });
  });
  assert(result.fallbackTriggered === true, 'executeWithRetry.fallbackTriggered=true when all keys fail');
  assert(result.data === null, 'executeWithRetry.data=null on full failure');

  // ─── TEST 5: Cooldown expiration restores key ────────────────────────────
  console.log('\n[TEST 5] Cooldown expiration restores key to READY:');
  // Use the first rotator with 200ms cooldown.
  await new Promise<void>((r) => setTimeout(r, 250));

  const statusAfterRestore = rotator.getStatus();
  assert(statusAfterRestore.slots[0].status === 'READY', 'Key 1 returns to READY after its cooldown expires');
  assert(statusAfterRestore.readyKeysCount === 3, 'All keys are READY after their cooldowns expire');

  // ─── TEST 6: Success recording ────────────────────────────────────────────
  console.log('\n[TEST 6] Success recording:');
  const rotator3 = new OpenRouterKeyRotator({ keys: ['key-a', 'key-b', 'key-c'] });
  const res = await rotator3.executeWithRetry(async (key) => {
    return `response-from-${key}`;
  });
  assert(res.fallbackTriggered === false, 'executeWithRetry succeeds with healthy keys');
  assert((res.data?.startsWith('response-from-') ?? false), 'Returns data on success');
  assert(res.usedSlotId === 1, 'Used slot 1 on first attempt');

  // ─── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${PASS} ${passed} passed, ${failed > 0 ? FAIL : ''} ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32mAll tests passed! Key Rotator is production-ready.\x1b[0m\n');
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
