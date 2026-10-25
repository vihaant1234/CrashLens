import { ClusterSimulator } from '../src/engine/simulator/ClusterSimulator';
import { CircularRingBuffer } from '../src/engine/simulator/RingBuffer';
import { CLUSTER_NODES, CLUSTER_EDGES } from '../src/engine/topology/clusterTopology';
import type { ClusterTelemetrySnapshot } from '../src/types/telemetry';

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const ring = new CircularRingBuffer<number>(3);
ring.push(1);
ring.push(2);
ring.push(3);
ring.push(4);
assert(ring.size === 3, 'Ring buffer should remain at capacity');
assert(
  ring.toArray().join(',') === '2,3,4',
  'Ring buffer should return wrapped values in chronological order'
);
assert(ring.latest() === 4, 'Ring buffer latest() should return the newest value');
ring.clear();
assert(ring.size === 0 && ring.latest() === undefined, 'clear() should reset the buffer');

const simulator = new ClusterSimulator(3);
const snapshots: ClusterTelemetrySnapshot[] = [];
let subscriberCalls = 0;
const unsubscribe = simulator.subscribe((snapshot) => {
  subscriberCalls++;
  snapshots.push(snapshot);
});

for (let tick = 1; tick <= 5; tick++) {
  const snapshot = simulator.tick();
  assert(snapshot.tick === tick, `Expected tick ${tick}, received ${snapshot.tick}`);
  assert(snapshot.activeIncidentId === null, 'Baseline simulation must not inject incidents');
  assert(Object.keys(snapshot.nodes).length === 12, 'Each tick must include all 12 nodes');
  assert(Object.keys(snapshot.edges).length === 14, 'Each tick must include all 14 edges');

  for (const node of Object.values(snapshot.nodes)) {
    const { cpuPct, memPct, p99Ms, rps, errorRatePct, threadPoolQueueDepth, connectionPoolUtilization } =
      node.metrics;
    assert(Number.isFinite(node.timestamp), 'Node timestamp must be finite');
    assert(cpuPct >= 0 && cpuPct <= 100, 'CPU must be between 0 and 100');
    assert(memPct >= 0 && memPct <= 100, 'Memory must be between 0 and 100');
    assert(p99Ms >= 1, 'Node latency must be positive');
    assert(rps > 0, 'Node RPS must be positive');
    assert(errorRatePct >= 0 && errorRatePct <= 100, 'Error rate must be between 0 and 100');
    assert(threadPoolQueueDepth >= 0, 'Queue depth must not be negative');
    assert(
      connectionPoolUtilization >= 0 && connectionPoolUtilization <= 1,
      'Connection pool utilization must be between 0 and 1'
    );
    assert(node.recentLogs.length > 0, 'Each node must emit a contextual log');
  }

  for (const edge of Object.values(snapshot.edges)) {
    assert(edge.latencyMs > 0, 'Edge latency must be positive');
    assert(edge.qps > 0, 'Edge QPS must be positive');
    assert(
      edge.saturationScore >= 0 && edge.saturationScore <= 1,
      'Edge saturation must be between 0 and 1'
    );
  }
}

assert(snapshots.length === 5, 'Subscribers should receive every emitted snapshot');
assert(subscriberCalls === 5, 'Subscriber should be called once per tick');
unsubscribe();
simulator.tick();
assert(subscriberCalls === 5, 'Unsubscribed listeners must not receive further ticks');

const history = simulator.getServiceHistory('payments-db');
assert(history.length === 3, 'Service history should be capped at its configured capacity');
for (let index = 1; index < history.length; index++) {
  assert(
    history[index].timestamp >= history[index - 1].timestamp,
    `Service history must be chronological at index ${index}`
  );
}
assert(
  history.map(({ timestamp }) => timestamp).join(',') ===
    snapshots.slice(-2).map(({ timestamp }) => timestamp).concat(
      simulator.getLatestSnapshot()?.timestamp ?? 0
    ).join(','),
  'Ring-buffer history should retain the newest snapshots in chronological order'
);
assert(CLUSTER_NODES.length === 12 && CLUSTER_EDGES.length === 14, 'Topology cardinality must remain 12/14');

console.log('Simulator validation passed: 12 nodes, 14 edges, bounded telemetry, subscribers, and ring-buffer wraparound.');
