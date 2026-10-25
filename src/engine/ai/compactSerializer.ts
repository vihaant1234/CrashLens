import type { ClusterTelemetrySnapshot } from '@/types/telemetry';
import type { ServiceId } from '@/types/topology';

export function serializeTelemetryDiff(
  snapshot: ClusterTelemetrySnapshot,
  zScores: Map<ServiceId, number>
): string {
  const rows = Object.values(snapshot.nodes)
    .filter((node) => Math.abs(zScores.get(node.serviceId) ?? 0) > 1.5 || node.status !== 'HEALTHY')
    .sort((a, b) => (zScores.get(b.serviceId) ?? 0) - (zScores.get(a.serviceId) ?? 0))
    .map((node) => {
      const z = zScores.get(node.serviceId) ?? 0;
      const tag = z >= 2.5 ? 'ANOMALY' : node.status !== 'HEALTHY' ? 'DEGRADED' : 'LAG';
      return `${node.serviceId.padEnd(18)} ${String(node.metrics.p99Ms).padStart(6)} ${node.metrics.errorRatePct.toFixed(1).padStart(5)} ${Math.round(node.metrics.cpuPct).toString().padStart(4)} ${Math.round(node.metrics.connectionPoolUtilization * 100).toString().padStart(5)} ${Math.round(node.metrics.threadPoolQueueDepth).toString().padStart(5)} ${z >= 0 ? '+' : ''}${z.toFixed(2).padStart(6)} ${tag}`;
    });
  const errors = Object.values(snapshot.nodes)
    .flatMap((node) => node.recentLogs
      .filter((log) => log.level === 'ERROR' || log.level === 'FATAL')
      .map((log) => `${node.serviceId}: ${log.message.replace(/\s+/g, ' ').slice(0, 100)}`))
    .slice(-3);

  return [
    'NODE               P99MS  ERR% CPU% CONN% QUEUE Z-SCORE STATE',
    ...(rows.length ? rows : ['No anomalous nodes']),
    'ERRORS:',
    ...(errors.length ? errors : ['none']),
  ].join('\n');
}
