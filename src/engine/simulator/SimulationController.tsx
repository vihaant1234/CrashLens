'use client';

import React, { useEffect } from 'react';
import { getClusterSimulator } from './ClusterSimulator';
import { useClusterStore } from '@/stores/useClusterStore';
import { analyzeClusterLocally } from '@/engine/analysis/AnomalyDetector';
import { usePredictionStore } from '@/stores/usePredictionStore';
import type { PredictionResult } from '@/types/prediction';
import type { ScenarioId } from '@/types/incidents';

interface SimulationControllerProps {
  children?: React.ReactNode;
  autoStart?: boolean;
  apiKeys?: [string, string, string];
  initialScenario?: ScenarioId;
}

/**
 * Top-level Simulation Controller
 * Wires the 1Hz ClusterSimulator engine events to the global Zustand store.
 */
export function SimulationController({
  children,
  autoStart = true,
  apiKeys,
  initialScenario,
}: SimulationControllerProps) {
  useEffect(() => {
    const simulator = getClusterSimulator();
    if (initialScenario && !simulator.getActiveIncident()) {
      simulator.injectIncident(initialScenario);
    }

    // Subscribe to simulator ticks and push directly into Zustand store
    const unsubscribe = simulator.subscribe((snapshot) => {
      useClusterStore.getState().ingestTick(snapshot);
      const { prediction: localPrediction, zScores } = analyzeClusterLocally(snapshot);
      const predictionStore = usePredictionStore.getState();
      if (localPrediction.anomalyDetected && !predictionStore.activePrediction) {
        predictionStore.setPrediction(localPrediction);
        predictionStore.setAnalyzing(true);
        const startedAt = performance.now();
        void fetch('/api/system1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            snapshot,
            zScores: [...zScores.entries()],
            apiKeys,
          }),
        })
          .then(async (response) => {
            if (!response.ok) throw new Error(`System 1 endpoint returned ${response.status}`);
            const keyStatus = await response.json() as {
              prediction?: PredictionResult;
              status?: import('@/engine/ai/rotatorTypes').PublicRotatorStatus;
            };
            if (keyStatus.status) {
              usePredictionStore.getState().setKeyRotatorStatus(keyStatus.status);
            }
            if (keyStatus.prediction) {
              usePredictionStore.getState().setPrediction(
                keyStatus.prediction,
                Math.round(performance.now() - startedAt),
                true
              );
            }
          })
          .catch((error: unknown) => {
            console.error('[SYSTEM1_FALLBACK_TO_TIER0]', error);
            usePredictionStore.getState().setAnalyzing(false);
          });
      } else if (
        !localPrediction.anomalyDetected &&
        predictionStore.activePrediction &&
        !predictionStore.isMitigated
      ) {
        predictionStore.clearPrediction();
      }
    });

    // Run first tick immediately to populate store
    const initialSnapshot = simulator.tick();
    useClusterStore.getState().ingestTick(initialSnapshot);

    if (autoStart) {
      useClusterStore.getState().startSimulation();
    }

    return () => {
      unsubscribe();
      simulator.stop();
    };
  }, [apiKeys, autoStart, initialScenario]);

  return <>{children}</>;
}
