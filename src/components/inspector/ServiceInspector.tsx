'use client';

import React, { useMemo } from 'react';
import {
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle,
  Activity,
} from 'lucide-react';
import type { ServiceId } from '@/types/topology';
import type { ClusterTelemetrySnapshot, NodeTelemetry } from '@/types/telemetry';
import { MetricSparkline } from './MetricSparkline';
import {
  CLUSTER_NODE_MAP,
  getUpstreamCallers,
  getDownstreamDependencies,
} from '@/engine/topology/clusterTopology';

interface ServiceInspectorProps {
  serviceId: ServiceId;
  snapshot: ClusterTelemetrySnapshot | null;
  /** 60-tick history from ring buffer */
  history: NodeTelemetry[];
  onClose: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'CRITICAL' || status === 'DEAD'
      ? 'bg-radar-red/20 text-radar-red border-radar-red/40 animate-pulse'
      : status === 'DEGRADED'
      ? 'bg-radar-amber/20 text-radar-amber border-radar-amber/40'
      : 'bg-radar-green/20 text-radar-green border-radar-green/40';
  return (
    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest ${cls}`}>
      {status}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded border border-border-cad bg-bg-pitch/60 p-2">
      <div className="font-mono text-[9px] tracking-wider text-text-muted uppercase mb-1">{label}</div>
      <div className={`font-mono text-sm font-bold ${alert ? 'text-radar-red' : 'text-text-cream'}`}>
        {value}
      </div>
      {sub && (
        <div className="font-mono text-[9px] text-text-muted mt-0.5">{sub}</div>
      )}
    </div>
  );
}

export function ServiceInspector({
  serviceId,
  snapshot,
  history,
  onClose,
}: ServiceInspectorProps) {
  const node = CLUSTER_NODE_MAP[serviceId];
  const telemetry = snapshot?.nodes[serviceId] ?? null;
  const metrics = telemetry?.metrics;

  // Derive sparkline data from history ring buffer
  const p99History = useMemo(
    () => history.map((h) => h.metrics.p99Ms),
    [history]
  );
  const cpuHistory = useMemo(
    () => history.map((h) => h.metrics.cpuPct),
    [history]
  );
  const memHistory = useMemo(
    () => history.map((h) => h.metrics.memPct),
    [history]
  );

  const upstreamCallers = getUpstreamCallers(serviceId);
  const downstreamDeps = getDownstreamDependencies(serviceId);

  const status = telemetry?.status ?? 'HEALTHY';

  // Compute deltas vs baseline
  const baseline = node?.baselines.p99Ms ?? 1;
  const currentP99 = metrics?.p99Ms ?? baseline;
  const deltaPercent = Math.round(((currentP99 - baseline) / baseline) * 100);

  const connPool = metrics?.connectionPoolUtilization ?? 0;
  const poolMax = 50; // representative max pool size
  const poolUsed = Math.round(connPool * poolMax);

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden bg-[#0d0f16]/95 backdrop-blur-md"
      style={{ fontFamily: 'monospace' }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-start justify-between border-b border-border-cad bg-bg-card/70 p-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent-amber" />
            <span className="font-mono text-sm font-bold tracking-widest text-text-cream uppercase">
              {serviceId}
            </span>
            <span className="rounded border border-accent-cyan/30 bg-accent-cyan/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-accent-cyan uppercase">
              {node?.role ?? 'service'}
            </span>
            <StatusBadge status={status} />
          </div>
          <span className="font-mono text-[10px] text-text-muted capitalize">
            {node?.role ?? 'service'} · tier {node?.tier ?? '?'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-text-muted hover:bg-white/10 hover:text-text-cream transition-colors"
          title="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Scrollable Content ───────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">

        {/* Key Metrics Grid 2×2 */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="p99 Latency"
            value={`${currentP99}ms`}
            sub={deltaPercent > 0 ? `+${deltaPercent}% vs ${baseline}ms baseline` : `baseline: ${baseline}ms`}
            alert={currentP99 > baseline * 5}
          />
          <MetricCard
            label="Error Rate"
            value={`${(metrics?.errorRatePct ?? 0).toFixed(2)}%`}
            alert={(metrics?.errorRatePct ?? 0) > 0.15}
          />
          <MetricCard
            label="CPU Load"
            value={`${Math.round(metrics?.cpuPct ?? 0)}%`}
            alert={(metrics?.cpuPct ?? 0) > 80}
          />
          <MetricCard
            label="Conn Pool"
            value={`${poolUsed}/${poolMax}`}
            sub={`${Math.round(connPool * 100)}% util`}
            alert={connPool > 0.85}
          />
        </div>

        {/* p99 Latency Sparkline */}
        <div className="rounded border border-border-cad bg-bg-card/40 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-semibold text-accent-amber tracking-wider">
              60-SECOND LATENCY TREND
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              {currentP99}ms now
            </span>
          </div>
          <MetricSparkline
            data={p99History}
            color="#ff8539"
            height={44}
            baseline={baseline}
            label={`${currentP99}ms`}
          />
        </div>

        {/* CPU & Memory Sparkline */}
        <div className="rounded border border-border-cad bg-bg-card/40 p-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] font-semibold text-accent-cyan tracking-wider">
              CPU &amp; MEMORY TREND
            </span>
            <span className="font-mono text-[10px] text-text-muted">
              CPU {Math.round(metrics?.cpuPct ?? 0)}% · MEM {Math.round(metrics?.memPct ?? 0)}%
            </span>
          </div>
          <MetricSparkline
            data={cpuHistory}
            color="#38bdf8"
            height={30}
            baseline={node?.baselines.cpuPct}
            label={`CPU`}
          />
          <div className="mt-1.5">
            <MetricSparkline
              data={memHistory}
              color="#a855f7"
              height={30}
              label={`MEM`}
            />
          </div>
        </div>

        {/* Dependency Cross-Reference */}
        <div className="rounded border border-border-cad bg-bg-card/40 p-2.5">
          <span className="font-mono text-[10px] font-semibold text-text-cream tracking-wider block mb-2">
            DEPENDENCIES
          </span>

          {upstreamCallers.length > 0 && (
            <div className="mb-2">
              <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider">
                ▲ Upstream Callers
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {upstreamCallers.map((callerId) => {
                  const callerTele = snapshot?.nodes[callerId];
                  const edgeLatency = snapshot?.edges[`${callerId}->${serviceId}`]?.latencyMs;
                  const isAlert = callerTele && callerTele.status !== 'HEALTHY';
                  return (
                    <div key={callerId} className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <ArrowUp className="h-3 w-3 text-accent-cyan" />
                        <span className="font-mono text-[10px] text-text-cream">{callerId}</span>
                      </div>
                      <span className={`font-mono text-[10px] ${isAlert ? 'text-radar-amber' : 'text-text-muted'}`}>
                        {edgeLatency === undefined ? '—' : `${edgeLatency}ms`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {downstreamDeps.length > 0 && (
            <div>
              <span className="font-mono text-[9px] text-text-muted uppercase tracking-wider">
                ▼ Downstream Deps
              </span>
              <div className="mt-1 flex flex-col gap-1">
                {downstreamDeps.map((depId) => {
                  const depTele = snapshot?.nodes[depId];
                  const edgeLatency = snapshot?.edges[`${serviceId}->${depId}`]?.latencyMs;
                  const isCritical = depTele?.status === 'CRITICAL' || depTele?.status === 'DEAD';
                  const isDegraded = depTele?.status === 'DEGRADED';
                  return (
                    <div key={depId} className="flex items-center justify-between rounded bg-white/5 px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        <ArrowDown className="h-3 w-3 text-radar-amber" />
                        <span className="font-mono text-[10px] text-text-cream">{depId}</span>
                        {isCritical && <AlertTriangle className="h-3 w-3 text-radar-red" />}
                        {isDegraded && <AlertTriangle className="h-3 w-3 text-radar-amber" />}
                        {!isCritical && !isDegraded && <CheckCircle className="h-3 w-3 text-radar-green" />}
                      </div>
                      <span className={`font-mono text-[10px] ${
                        isCritical ? 'text-radar-red font-bold' : isDegraded ? 'text-radar-amber' : 'text-text-muted'
                      }`}>
                        {edgeLatency === undefined ? '—' : `${edgeLatency}ms`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {upstreamCallers.length === 0 && downstreamDeps.length === 0 && (
            <span className="font-mono text-[10px] text-text-muted">No dependencies mapped.</span>
          )}
        </div>

        {/* Live Log Terminal */}
        <div className="rounded border border-border-cad bg-bg-pitch p-2">
          <span className="font-mono text-[10px] font-semibold text-text-muted tracking-wider block mb-1.5">
            LIVE LOGS
          </span>
          <div className="flex flex-col gap-0.5 font-mono text-[10px]">
            {(telemetry?.recentLogs ?? []).slice(0, 8).map((log, idx) => {
              const ts = new Date(log.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });
              const logColor =
                log.level === 'ERROR' || log.level === 'FATAL'
                  ? 'text-radar-red'
                  : log.level === 'WARN'
                  ? 'text-radar-amber'
                  : 'text-accent-cyan';
              return (
                <div key={idx} className="flex gap-1.5 py-0.5">
                  <span className="shrink-0 text-text-muted">{ts}</span>
                  <span className={`shrink-0 font-bold ${logColor}`}>[{log.level}]</span>
                  <span className="text-text-muted leading-tight">{log.message}</span>
                </div>
              );
            })}
            {(!telemetry?.recentLogs || telemetry.recentLogs.length === 0) && (
              <span className="text-text-muted">No recent log entries.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
