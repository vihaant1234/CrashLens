'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ShieldAlert, Zap } from 'lucide-react';
import type { PredictionResult } from '@/types/prediction';

interface RcaAlertBannerProps {
  prediction: PredictionResult | null;
  timeToCriticalRemaining: number;
  resolvedAtTick?: number | null;
  globalErrorRate?: number;
  p99Ms?: number;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainder = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainder}`;
}

export function RcaAlertBanner({
  prediction,
  timeToCriticalRemaining,
  resolvedAtTick,
  globalErrorRate = 0.02,
  p99Ms = 0,
}: RcaAlertBannerProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (prediction?.anomalyDetected) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setVisible(false);
  }, [prediction?.anomalyDetected]);

  if (!prediction?.anomalyDetected) return null;
  const resolved = resolvedAtTick !== null && resolvedAtTick !== undefined;

  return (
    <div
      role="status"
      className={`mb-2 w-full max-w-5xl rounded-md border px-3 py-2 font-mono shadow-lg backdrop-blur-md transition-all duration-300 ${
        resolved
          ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
          : 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
      } ${visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
    >
      {resolved ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="h-4 w-4" />
            SYSTEM SAVED — RECOVERY APPLIED AT T+{resolvedAtTick}s
          </div>
          <div className="text-[10px]">
            Global Error Rate: {globalErrorRate.toFixed(2)}% | p99: {p99Ms}ms
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide">
            <ShieldAlert className="h-4 w-4 animate-pulse" />
            PRE-FAILURE DETECTED // CONFIDENCE: {Math.round(prediction.confidence * 100)}%
          </div>
          <div className="text-[10px]">
            CULPRIT: {prediction.rootCauseService ?? 'UNKNOWN'} | MODE: {prediction.failureMode} | BLAST: {prediction.blastRadiusServices.length}
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Zap className="h-4 w-4" />
            SLA COLLAPSE IN: {formatCountdown(timeToCriticalRemaining)}
          </div>
        </div>
      )}
    </div>
  );
}
