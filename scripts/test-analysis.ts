import { AnomalyDetector } from '../src/engine/analysis/AnomalyDetector';
import { ClusterSimulator } from '../src/engine/simulator/ClusterSimulator';
import type { NodeTelemetry } from '../src/types/telemetry';
import type { ServiceId } from '../src/types/topology';
import { generateCounterfactualPair } from '../src/engine/simulator/counterfactualModel';
import { generateRecoveryStrategies } from '../src/engine/analysis/recoveryStrategies';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`✔ ${message}`);
}

const simulator = new ClusterSimulator();
const baselineSnapshot = simulator.tick();
const baselineHistory = new Map<ServiceId, NodeTelemetry[]>();
for (const [id, telemetry] of Object.entries(baselineSnapshot.nodes) as [
  ServiceId,
  NodeTelemetry,
][]) {
  baselineHistory.set(id, Array.from({ length: 20 }, () => telemetry));
}

const detector = new AnomalyDetector((serviceId) => baselineHistory.get(serviceId) ?? []);
const healthy = detector.analyze(baselineSnapshot).prediction;
assert(!healthy.anomalyDetected, 'Baseline telemetry is not classified as anomalous');

simulator.injectIncident('DB_POOL_LEAK');
let result = healthy;
let lastAnalysis: ReturnType<AnomalyDetector['analyze']> | null = null;
const startedAt = performance.now();
for (let tick = 0; tick < 24; tick++) {
  lastAnalysis = detector.analyze(simulator.tick());
  result = lastAnalysis.prediction;
}
const durationMs = performance.now() - startedAt;

assert(result.anomalyDetected, 'DB pool leak is detected');
assert(result.rootCauseService === 'payments-db', 'payments-db is identified as the root cause');
assert((lastAnalysis?.anomalies.find((item) => item.serviceId === 'payments-db')?.zScore ?? 0) > 4, 'payments-db anomaly Z-score exceeds 4');
assert(result.blastRadiusServices.includes('payments-svc'), 'Blast radius includes payments-svc');
assert(result.blastRadiusServices.includes('orders-svc'), 'Blast radius includes orders-svc');
assert(
  durationMs / 24 < 5,
  `Local analysis averages under 5ms per tick (measured ${(durationMs / 24).toFixed(2)}ms)`
);

const strategies = generateRecoveryStrategies(result);
assert(strategies.length === 3, 'Recovery advisor generates three strategies');
assert(strategies[0].estimatedRiskReductionPct === 88, 'Recommended DB recovery strategy reduces risk by 88%');

const pair = generateCounterfactualPair('DB_POOL_LEAK');
assert(pair.mitigated.length === 45 && pair.unmitigated.length === 45, 'Counterfactual creates 45 synchronized samples');
assert(pair.unmitigated[20].ordersStatus !== 'HEALTHY', 'Unmitigated orders service degrades at T+20');
assert(pair.unmitigated[34].gatewayStatus === 'DEAD', 'Unmitigated gateway is offline by T+34');
assert(pair.unmitigated[40].errorRatePct === 94.2, 'Unmitigated error rate reaches 94.2% at T+40');

const currentDbP99 = simulator.getLatestSnapshot()!.nodes['payments-db'].metrics.p99Ms;
simulator.applyMitigation(strategies[0]);
const recoveryValues = Array.from({ length: 4 }, () =>
  simulator.tick().nodes['payments-db'].metrics.p99Ms
);
assert(recoveryValues[0] < currentDbP99, 'Mitigation begins exponential latency recovery on the next tick');
assert(recoveryValues.every((value, index) => index === 0 || value <= recoveryValues[index - 1]), 'Mitigation latency decreases monotonically');
assert(simulator.getServiceHistory('payments-db').length > 25, 'Mitigation recovery snapshots remain in ring-buffer history');
