Read AGENTS.md first and follow it strictly.

# Prompt 05: Global Zustand Cluster State & 1Hz Simulation Wiring

## Objective
Implement the global Zustand state management layer for CrashLens, connecting the 1Hz telemetry generator (`ClusterSimulator`) to the React application state so metrics, simulation controls, and selected service inspection stay synchronized in real time.

## Negative Constraints
- **Do not write the failure incident injection logic yet** (cluster operates in baseline healthy mode).
- **Do not implement OpenRouter or System 1 AI inference calls yet.**
- **Avoid triggering full React subtree re-renders on every 1-second tick**; use selective Zustand state selectors.
- Focus strictly on state management, simulation tick ingestion, and store subscriptions.

## Step-by-Step Instructions

1. **Construct the Cluster Store (`src/stores/useClusterStore.ts`)**:
   Create a typed Zustand store managing real-time cluster data:
   ```typescript
   interface ClusterStoreState {
     // Telemetry State
     currentTick: number;
     activeSnapshot: ClusterTelemetrySnapshot | null;
     selectedServiceId: ServiceId | null;
     
     // Simulation Controls
     isSimulating: boolean;
     simulationSpeed: 1 | 2 | 5;
     
     // Actions
     startSimulation: () => void;
     pauseSimulation: () => void;
     setSpeed: (speed: 1 | 2 | 5) => void;
     selectService: (serviceId: ServiceId | null) => void;
     ingestTick: (snapshot: ClusterTelemetrySnapshot) => void;
     resetCluster: () => void;
   }
   ```

2. **Wire `ClusterSimulator` to Zustand**:
   - In a top-level provider or simulation controller (`src/engine/simulator/SimulationController.tsx`):
     - Instantiate the singleton `ClusterSimulator`.
     - Subscribe to simulator ticks:
       ```typescript
       simulator.subscribe((snapshot) => {
         useClusterStore.getState().ingestTick(snapshot);
       });
       ```
     - Connect `startSimulation`, `pauseSimulation`, and `setSpeed` to the simulator controls.

3. **Wire Live Metrics to `RadarShell` Components**:
   - Update `RadarHeader`:
     - Global Error Rate: Calculate weighted average error percentage across all 12 nodes.
     - Cluster RPS: Sum RPS across all active nodes.
     - Active Nodes Count: Display healthy vs degraded count (`12/12 ONLINE`).
     - Simulation Clock: Show formatted time `T+00:42s`.
   - Update `SimulationDock`:
     - Bind Play/Pause button state and speed toggle (`1x`, `2x`, `5x`).
     - Bind Reset button to `resetCluster()`.

4. **Verify React Render Efficiency**:
   - Use atomic Zustand selectors (e.g. `const isSimulating = useClusterStore(s => s.isSimulating)`) so only specific metric badges re-render on ticks rather than the whole radar canvas.

## Documentation Injection
(Here paste Zustand v5 subscribeWithSelector and performance optimization best practices)

## Verification
- Start the simulation; verify that the tick counter increments every second (`1s`, `2s`, `3s`...).
- Verify that pressing Pause freezes the simulation and pressing Play resumes it.
- Verify that toggling speed to `2x` doubles the tick frequency.
