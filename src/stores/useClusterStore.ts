/**
 * CrashLens Global Zustand Cluster State Store
 * High-frequency telemetry ingestion, simulation clock controls, and service selection.
 */

import { create } from 'zustand';
import type { ServiceId } from '@/types/topology';
import type { ClusterTelemetrySnapshot } from '@/types/telemetry';
import type { ScenarioId, IncidentState } from '@/types/incidents';
import { getClusterSimulator } from '@/engine/simulator/ClusterSimulator';
import { usePredictionStore } from './usePredictionStore';

export interface ClusterStoreState {
  // Telemetry State
  currentTick: number;
  activeSnapshot: ClusterTelemetrySnapshot | null;
  selectedServiceId: ServiceId | null;

  // Simulation Controls
  isSimulating: boolean;
  simulationSpeed: 1 | 2 | 5;

  // Chaos & Incident State
  activeIncident: IncidentState | null;

  // Actions
  startSimulation: () => void;
  pauseSimulation: () => void;
  setSpeed: (speed: 1 | 2 | 5) => void;
  selectService: (serviceId: ServiceId | null) => void;
  ingestTick: (snapshot: ClusterTelemetrySnapshot) => void;
  resetCluster: () => void;
  injectIncident: (scenarioId: ScenarioId) => void;
  clearIncident: () => void;
}

export const useClusterStore = create<ClusterStoreState>((set, get) => ({
  currentTick: 0,
  activeSnapshot: null,
  selectedServiceId: null,
  isSimulating: false,
  simulationSpeed: 1,
  activeIncident: null,

  startSimulation: () => {
    const simulator = getClusterSimulator();
    const speed = get().simulationSpeed;
    const intervalMs = Math.round(1000 / speed);
    simulator.start(intervalMs);
    set({ isSimulating: true });
  },

  pauseSimulation: () => {
    const simulator = getClusterSimulator();
    simulator.stop();
    set({ isSimulating: false });
  },

  setSpeed: (speed: 1 | 2 | 5) => {
    const simulator = getClusterSimulator();
    const wasRunning = get().isSimulating;
    if (wasRunning) {
      simulator.stop();
      simulator.start(Math.round(1000 / speed));
    }
    set({ simulationSpeed: speed });
  },

  selectService: (serviceId: ServiceId | null) => {
    set({ selectedServiceId: serviceId });
  },

  ingestTick: (snapshot: ClusterTelemetrySnapshot) => {
    const simulator = getClusterSimulator();
    set({
      currentTick: snapshot.tick,
      activeSnapshot: snapshot,
      activeIncident: simulator.getActiveIncident(),
    });
  },

  resetCluster: () => {
    const simulator = getClusterSimulator();
    simulator.reset();
    usePredictionStore.getState().clearPrediction();
    const initialSnapshot = simulator.tick();
    set({
      currentTick: initialSnapshot.tick,
      activeSnapshot: initialSnapshot,
      activeIncident: null,
      selectedServiceId: null,
    });
  },

  injectIncident: (scenarioId: ScenarioId) => {
    const simulator = getClusterSimulator();
    simulator.injectIncident(scenarioId);
    usePredictionStore.getState().clearPrediction();
    set({ activeIncident: simulator.getActiveIncident() });
  },

  clearIncident: () => {
    const simulator = getClusterSimulator();
    simulator.clearIncident();
    usePredictionStore.getState().clearPrediction();
    set({ activeIncident: null });
  },
}));
