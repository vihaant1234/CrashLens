'use client';

import { ShieldCheck, Zap } from 'lucide-react';
import type { PredictionResult } from '@/types/prediction';
import type { RecoveryStrategy } from '@/types/recovery';
import { generateRecoveryStrategies } from '@/engine/analysis/recoveryStrategies';

interface RecoveryAdvisorPanelProps {
  prediction: PredictionResult;
  isMitigated?: boolean;
  onApply: (strategy: RecoveryStrategy) => void;
}

function StrategyCard({
  item,
  onApply,
  isMitigated,
}: {
  item: RecoveryStrategy;
  onApply: () => void;
  isMitigated: boolean;
}) {
  return (
    <article className={`rounded-md border p-2.5 ${item.isRecommended ? 'border-accent-amber/60 bg-accent-amber/5 shadow-amber-glow' : 'border-border-cad bg-bg-pitch/40'}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-mono text-[11px] font-semibold text-text-cream">{item.title}</h3>
        {item.isRecommended && <span className="shrink-0 rounded bg-accent-amber/20 px-1.5 py-0.5 font-mono text-[8px] font-bold text-accent-amber">RECOMMENDED</span>}
      </div>
      <div className="mt-1 font-mono text-[9px] text-text-muted">
        TARGET: {item.targetService} · ETA: ~{item.estimatedTimeToRecoverSec}s
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded bg-white/10">
          <div className="h-full rounded bg-gradient-to-r from-emerald-500 to-accent-amber" style={{ width: `${item.estimatedRiskReductionPct}%` }} />
        </div>
        <span className="font-mono text-[10px] font-bold text-emerald-300">{item.estimatedRiskReductionPct}%</span>
      </div>
      <p className="mt-1.5 font-mono text-[9px] leading-relaxed text-text-muted">{item.tradeoff}</p>
      <button
        type="button"
        disabled={isMitigated}
        onClick={onApply}
        className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 font-mono text-[10px] font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
          item.isRecommended
            ? 'border-accent-amber/60 bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25'
            : 'border-border-cad bg-white/5 text-text-muted hover:text-text-cream'
        }`}
      >
        <Zap className="h-3.5 w-3.5" />
        {isMitigated ? 'MITIGATION APPLIED' : item.isRecommended ? 'APPLY THIS MITIGATION' : 'APPLY ALTERNATIVE'}
      </button>
    </article>
  );
}

export function RecoveryAdvisorPanel({
  prediction,
  isMitigated = false,
  onApply,
}: RecoveryAdvisorPanelProps) {
  const strategies = generateRecoveryStrategies(prediction);
  return (
    <section className="flex max-h-[44vh] shrink-0 flex-col border-t border-border-cad bg-bg-panel/95">
      <div className="flex items-center justify-between border-b border-border-cad px-3 py-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-accent-cyan" />
          <h2 className="font-mono text-[10px] font-bold tracking-wider text-accent-cyan">AI RECOVERY ADVISOR</h2>
        </div>
        <span className="font-mono text-[8px] text-text-muted">SYSTEM 1 · REFLEX ACTION</span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto p-2.5">
        <p className="font-mono text-[9px] text-text-muted">
          {strategies.length} strategies for {prediction.rootCauseService ?? 'cluster degradation'} · {prediction.failureMode}
        </p>
        {strategies.map((item) => (
          <StrategyCard
            key={item.id}
            item={item}
            isMitigated={isMitigated}
            onApply={() => onApply(item)}
          />
        ))}
      </div>
    </section>
  );
}
