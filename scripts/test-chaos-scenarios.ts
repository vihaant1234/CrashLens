/**
 * Automated Verification Script for Prompts 04, 05, 06
 * Tests deterministic chaos propagation curves and recovery across all 4 scenarios.
 */

import { ClusterSimulator } from '../src/engine/simulator/ClusterSimulator';

console.log('=== Starting CrashLens Chaos Scenarios Test ===\n');

const simulator = new ClusterSimulator(60);

// 1. Initial healthy baseline test
console.log('1. Checking healthy baseline ticks...');
for (let i = 0; i < 3; i++) {
  const snap = simulator.tick();
  if (snap.globalStatus !== 'HEALTHY') {
    throw new Error(`Expected baseline HEALTHY, got ${snap.globalStatus}`);
  }
}
console.log('✓ Baseline ticks verified as HEALTHY.\n');

// 2. Test Scenario A: DB_POOL_LEAK
console.log('2. Testing Scenario A: DB_POOL_LEAK (PostgreSQL Pool Leak)...');
simulator.injectIncident('DB_POOL_LEAK');

let paymentsDbDegraded = false;
let paymentsSvcDegraded = false;
let ordersSvcCritical = false;
let apiGatewayCritical = false;

for (let tick = 0; tick < 35; tick++) {
  const snap = simulator.tick();
  const db = snap.nodes['payments-db'];
  const svc = snap.nodes['payments-svc'];
  const orders = snap.nodes['orders-svc'];
  const gw = snap.nodes['api-gateway'];

  if (db.metrics.connectionPoolUtilization > 0.5) {
    paymentsDbDegraded = true;
  }
  if (svc.metrics.p99Ms > 300) {
    paymentsSvcDegraded = true;
  }
  if (orders.status === 'CRITICAL' || orders.metrics.errorRatePct > 20) {
    ordersSvcCritical = true;
  }
  if (gw.status === 'CRITICAL' || gw.metrics.errorRatePct > 40) {
    apiGatewayCritical = true;
  }

  if (tick === 5 || tick === 15 || tick === 25 || tick === 34) {
    console.log(
      `  [T+${tick}s] Global: ${snap.globalStatus} | payments-db: conns=${Math.round(db.metrics.connectionPoolUtilization * 100)}%, p99=${db.metrics.p99Ms}ms | payments-svc: p99=${svc.metrics.p99Ms}ms | orders-svc err=${orders.metrics.errorRatePct}% | gw err=${gw.metrics.errorRatePct}%`
    );
  }
}

if (!paymentsDbDegraded) throw new Error('payments-db failed to degrade in Scenario A');
if (!paymentsSvcDegraded) throw new Error('payments-svc failed to degrade in Scenario A');
if (!ordersSvcCritical) throw new Error('orders-svc failed to reach critical in Scenario A');
if (!apiGatewayCritical) throw new Error('api-gateway failed to reach critical in Scenario A');
console.log('✓ Scenario A cascade propagation verified.\n');

// 3. Test Clearing Chaos & Recovery
console.log('3. Testing Chaos Abort & Recovery...');
simulator.clearIncident();
const recoveredSnap = simulator.tick();
console.log(`  After clearIncident: payments-db status=${recoveredSnap.nodes['payments-db'].status}, globalStatus=${recoveredSnap.globalStatus}`);
if (recoveredSnap.globalStatus !== 'HEALTHY') {
  throw new Error(`Expected cluster to recover to HEALTHY, but got ${recoveredSnap.globalStatus}`);
}
console.log('✓ Chaos clearing and baseline recovery verified.\n');

// 4. Test Scenario B: CACHE_STAMPEDE
console.log('4. Testing Scenario B: CACHE_STAMPEDE (Redis Invalidation)...');
simulator.injectIncident('CACHE_STAMPEDE');
for (let t = 0; t < 10; t++) {
  simulator.tick();
}
const cacheSnap = simulator.getLatestSnapshot()!;
const whCpu = cacheSnap.nodes['warehouse-db'].metrics.cpuPct;
console.log(`  [T+10s] redis-cache: status=${cacheSnap.nodes['redis-cache'].status} | warehouse-db CPU=${whCpu}%`);
if (whCpu < 70) {
  throw new Error(`Expected warehouse-db CPU surge > 70%, got ${whCpu}%`);
}
simulator.clearIncident();
console.log('✓ Scenario B verified.\n');

// 5. Test Scenario C: THREAD_STARVATION
console.log('5. Testing Scenario C: THREAD_STARVATION (auth-svc Bcrypt)...');
simulator.injectIncident('THREAD_STARVATION');
for (let t = 0; t < 15; t++) {
  simulator.tick();
}
const authSnap = simulator.getLatestSnapshot()!;
const authP99 = authSnap.nodes['auth-svc'].metrics.p99Ms;
console.log(`  [T+15s] auth-svc: p99=${authP99}ms, status=${authSnap.nodes['auth-svc'].status}`);
if (authP99 < 800) {
  throw new Error(`Expected auth-svc p99 > 800ms, got ${authP99}ms`);
}
simulator.clearIncident();
console.log('✓ Scenario C verified.\n');

// 6. Test Scenario D: RETRY_STORM
console.log('6. Testing Scenario D: RETRY_STORM (notification-svc retries)...');
simulator.injectIncident('RETRY_STORM');
for (let t = 0; t < 12; t++) {
  simulator.tick();
}
const retrySnap = simulator.getLatestSnapshot()!;
const ordersMem = retrySnap.nodes['orders-svc'].metrics.memPct;
console.log(`  [T+12s] notification-svc: status=${retrySnap.nodes['notification-svc'].status} | orders-svc memPct=${ordersMem}%`);
if (ordersMem < 65) {
  throw new Error(`Expected orders-svc memory creep > 65%, got ${ordersMem}%`);
}
simulator.clearIncident();
console.log('✓ Scenario D verified.\n');

console.log('=== All Chaos Scenarios & Incident Injector Tests PASSED ===');
