'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { ScenarioId } from '@/types/incidents';
import { generateCounterfactualPair, scenarioRoot } from '@/engine/simulator/counterfactualModel';
import { MetricSparkline } from '@/components/inspector/MetricSparkline';
import { TimelineScrubber } from './TimelineScrubber';

interface SavedVsCrashedViewerProps {
  scenarioId: ScenarioId;
  onClose: () => void;
}

export function SavedVsCrashedViewer({ scenarioId, onClose }: SavedVsCrashedViewerProps) {
  const pair = useMemo(() => generateCounterfactualPair(scenarioId), [scenarioId]);
  const max = pair.mitigated.length - 1;
  const [tick, setTick] = useState(18);
  const [isPlaying, setIsPlaying] = useState(false);
  const root = scenarioRoot(scenarioId);
  const saved = pair.mitigated[tick];
  const crashed = pair.unmitigated[tick];

  useEffect(() => {
    if (isPlaying && tick >= max) setIsPlaying(false);
  }, [isPlaying, tick, max]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setTick((current) => Math.min(max, current + 1));
    }, 250);
    return () => clearInterval(timer);
  }, [isPlaying, max]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Saved versus crashed counterfactual timeline"
      onClick={onClose}
    >
      <section
        className="flex max-h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-border-cad-bright bg-bg-panel shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <h2 className="font-mono text-sm font-bold tracking-widest text-text-cream">CRASHLENS COUNTERFACTUAL VERIFICATION</h2>
            <p className="font-mono text-[9px] text-text-muted">{scenarioId} · synchronized deterministic scenario replay</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-2 text-text-muted hover:bg-white/10 hover:text-white" aria-label="Close comparison"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-px overflow-y-auto bg-white/10 md:grid-cols-2">
          <TimelinePane
            title="SAVED WITH CRASHLENS"
            tone="green"
            status={saved.rootStatus}
            p99={saved.p99Ms}
            errorRate={saved.errorRatePct}
            samples={pair.mitigated.slice(0, tick + 1)}
            summary={`PRE-FAILURE FLAG T+12 · MITIGATION T+14 · ${tick >= 19 ? 'SLA PROTECTED' : 'INCIDENT RISING'}`}
            impact={`${pair.impact.droppedTransactions.mitigated} dropped · $${pair.impact.revenueAtRisk.mitigated.toLocaleString()} at risk`}
            root={root}
          />
          <TimelinePane
            title="CRASHED WITHOUT CRASHLENS"
            tone="red"
            status={crashed.gatewayStatus === 'DEAD' ? 'DEAD' : crashed.rootStatus}
            p99={crashed.p99Ms}
            errorRate={crashed.errorRatePct}
            samples={pair.unmitigated.slice(0, tick + 1)}
            summary={`FIRST HUMAN ALERT T+28 · GATEWAY BLACKOUT T+34 · ${tick >= 34 ? 'SLA VIOLATED' : 'CASCADE PROGRESSING'}`}
            impact={`${pair.impact.droppedTransactions.unmitigated.toLocaleString()} dropped · $${pair.impact.revenueAtRisk.unmitigated.toLocaleString()} at risk`}
            root={root}
          />
        </div>
        <TimelineScrubber
          value={tick}
          max={max}
          isPlaying={isPlaying}
          onChange={(value) => { setIsPlaying(false); setTick(value); }}
          onTogglePlay={() => setIsPlaying((playing) => !playing)}
          onReplay={() => { setIsPlaying(false); setTick(0); }}
        />
      </section>
    </div>
  );
}

function TimelinePane({
  title,
  tone,
  status,
  p99,
  errorRate,
  samples,
  summary,
  impact,
  root,
}: {
  title: string;
  tone: 'green' | 'red';
  status: string;
  p99: number;
  errorRate: number;
  samples: Array<{ p99Ms: number; tick: number }>;
  summary: string;
  impact: string;
  root: string;
}) {
  const color = tone === 'green' ? '#22c55e' : '#ef4444';
  return (
    <article className={`min-h-72 bg-bg-pitch p-4 ${tone === 'green' ? 'border-t-2 border-emerald-500/70' : 'border-t-2 border-red-500/70'}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-mono text-xs font-bold tracking-wider ${tone === 'green' ? 'text-emerald-300' : 'text-red-300'}`}>{title}</h3>
        <span className="font-mono text-[9px] text-text-muted">{status}</span>
      </div>
      <p className="mt-2 font-mono text-[9px] text-text-muted">{root} · {summary}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded border border-white/10 bg-white/[0.03] p-2">
          <div className="font-mono text-[8px] text-text-muted">ERROR RATE</div>
          <div className={`font-mono text-lg font-bold ${tone === 'green' ? 'text-emerald-300' : 'text-red-300'}`}>{errorRate.toFixed(2)}%</div>
        </div>
        <div className="rounded border border-white/10 bg-white/[0.03] p-2">
          <div className="font-mono text-[8px] text-text-muted">P99 LATENCY</div>
          <div className={`font-mono text-lg font-bold ${tone === 'green' ? 'text-emerald-300' : 'text-red-300'}`}>{p99}ms</div>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[8px] text-text-muted">
        <span>ORDERS: {samples[samples.length - 1]?.tick === undefined ? 'HEALTHY' : tone === 'red' && (samples[samples.length - 1]?.tick ?? 0) >= 20 ? 'DEGRADED' : 'HEALTHY'}</span>
        <span>GATEWAY: {tone === 'red' && (samples[samples.length - 1]?.tick ?? 0) >= 34 ? 'OFFLINE' : 'HEALTHY'}</span>
      </div>
      <div className="mt-3 rounded border border-white/10 bg-white/[0.03] p-2">
        <div className="mb-2 font-mono text-[9px] text-text-muted">P99 TREND · {impact}</div>
        <MetricSparkline data={samples.map((sample) => sample.p99Ms)} color={color} height={64} />
      </div>
    </article>
  );
}
