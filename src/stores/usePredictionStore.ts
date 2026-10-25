'use client';

import { create } from 'zustand';
import type { PredictionResult } from '@/types/prediction';
import type { RecoveryStrategy } from '@/types/recovery';
import type { PublicRotatorStatus } from '@/engine/ai/rotatorTypes';

interface PredictionStoreState {
  activePrediction: PredictionResult | null;
  timeToCriticalRemaining: number;
  isAnalyzing: boolean;
  lastInferenceDurationMs: number | null;
  isMitigated: boolean;
  mitigationAppliedAtTick: number | null;
  showComparison: boolean;
  setPrediction: (
    prediction: PredictionResult,
    inferenceDurationMs?: number | null,
    preserveCountdown?: boolean
  ) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
  tickCountdown: () => void;
  clearPrediction: () => void;
  markMitigated: (tick: number) => void;
  setShowComparison: (show: boolean) => void;
  selectedRecoveryStrategy: RecoveryStrategy | null;
  keyRotatorStatus: PublicRotatorStatus | null;
  setSelectedRecoveryStrategy: (strategy: RecoveryStrategy | null) => void;
  setKeyRotatorStatus: (status: PublicRotatorStatus) => void;
}

let countdownTimer: ReturnType<typeof setInterval> | null = null;

export const usePredictionStore = create<PredictionStoreState>((set, get) => ({
  activePrediction: null,
  timeToCriticalRemaining: 0,
  isAnalyzing: false,
  lastInferenceDurationMs: null,
  isMitigated: false,
  mitigationAppliedAtTick: null,
  showComparison: false,
  selectedRecoveryStrategy: null,
  keyRotatorStatus: null,

  setPrediction: (prediction, inferenceDurationMs = null, preserveCountdown = false) => {
    const remaining = preserveCountdown
      ? get().timeToCriticalRemaining
      : prediction.anomalyDetected
        ? Math.ceil(prediction.timeToCriticalSec)
        : 0;
    set({
      activePrediction: prediction,
      timeToCriticalRemaining: remaining,
      isAnalyzing: false,
      lastInferenceDurationMs: inferenceDurationMs ?? get().lastInferenceDurationMs,
      ...(preserveCountdown ? {} : {
        isMitigated: false,
        mitigationAppliedAtTick: null,
        showComparison: false,
      }),
    });
    if (prediction.anomalyDetected && !countdownTimer) {
      countdownTimer = setInterval(() => {
        const current = get();
        if (!current.activePrediction?.anomalyDetected || current.timeToCriticalRemaining <= 0) {
          if (countdownTimer) clearInterval(countdownTimer);
          countdownTimer = null;
          return;
        }
        current.tickCountdown();
      }, 1000);
    }
    if (!prediction.anomalyDetected && countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  },
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  tickCountdown: () =>
    set((state) => ({ timeToCriticalRemaining: Math.max(0, state.timeToCriticalRemaining - 1) })),
  clearPrediction: () => {
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    set({
      activePrediction: null,
      timeToCriticalRemaining: 0,
      isAnalyzing: false,
      isMitigated: false,
      mitigationAppliedAtTick: null,
      showComparison: false,
      selectedRecoveryStrategy: null,
    });
  },
  markMitigated: (tick) => set({
    isMitigated: true,
    mitigationAppliedAtTick: tick,
    showComparison: true,
  }),
  setShowComparison: (showComparison) => set({ showComparison }),
  setSelectedRecoveryStrategy: (selectedRecoveryStrategy) => set({ selectedRecoveryStrategy }),
  setKeyRotatorStatus: (keyRotatorStatus) => set({ keyRotatorStatus }),
}));
