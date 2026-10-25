'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Radio,
  Terminal,
  ShieldCheck,
  Zap,
  XCircle,
  Flame,
  Key,
} from 'lucide-react';
import { TopologyCanvas } from './TopologyCanvas';
import { useClusterStore } from '@/stores/useClusterStore';
import { INCIDENT_CONFIGS, ScenarioId } from '@/types/incidents';
import { CLUSTER_NODES } from '@/engine/topology/clusterTopology';
import { ServiceInspector } from '@/components/inspector/ServiceInspector';
import { getClusterSimulator } from '@/engine/simulator/ClusterSimulator';
import { getKeyRotator } from '@/engine/ai/OpenRouterKeyRotator';
import type { NodeTelemetry } from '@/types/telemetry';
import { usePredictionStore } from '@/stores/usePredictionStore';
import { RcaAlertBanner } from './RcaAlertBanner';
import { RecoveryAdvisorPanel } from '@/components/advisor/RecoveryAdvisorPanel';
import type { RecoveryStrategy } from '@/types/recovery';
import { SavedVsCrashedViewer } from '@/components/comparison/SavedVsCrashedViewer';

interface RadarShellProps {
  children?: React.ReactNode;
  standalone?: boolean;
  compactMode?: boolean;
  onIncidentResolved?: () => void;
}

export function RadarShell({
  children,
  standalone = true,
  compactMode = false,
  onIncidentResolved,
}: RadarShellProps) {
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(true);
  const [isChaosMenuOpen, setIsChaosMenuOpen] = useState<boolean>(false);

  // Zustand atomic selectors
  const currentTick = useClusterStore((s) => s.currentTick);
  const activeSnapshot = useClusterStore((s) => s.activeSnapshot);
  const selectedServiceId = useClusterStore((s) => s.selectedServiceId);
  const isSimulating = useClusterStore((s) => s.isSimulating);
  const simulationSpeed = useClusterStore((s) => s.simulationSpeed);
  const activeIncident = useClusterStore((s) => s.activeIncident);

  // Actions
  const startSimulation = useClusterStore((s) => s.startSimulation);
  const pauseSimulation = useClusterStore((s) => s.pauseSimulation);
  const setSpeed = useClusterStore((s) => s.setSpeed);
  const selectService = useClusterStore((s) => s.selectService);
  const resetCluster = useClusterStore((s) => s.resetCluster);
  const injectIncident = useClusterStore((s) => s.injectIncident);
  const clearIncident = useClusterStore((s) => s.clearIncident);
  const activePrediction = usePredictionStore((s) => s.activePrediction);
  const timeToCriticalRemaining = usePredictionStore((s) => s.timeToCriticalRemaining);
  const isMitigated = usePredictionStore((s) => s.isMitigated);
  const mitigationAppliedAtTick = usePredictionStore((s) => s.mitigationAppliedAtTick);
  const showComparison = usePredictionStore((s) => s.showComparison);
  const setShowComparison = usePredictionStore((s) => s.setShowComparison);
  const markMitigated = usePredictionStore((s) => s.markMitigated);
  const setSelectedRecoveryStrategy = usePredictionStore((s) => s.setSelectedRecoveryStrategy);
  const lastInferenceDurationMs = usePredictionStore((s) => s.lastInferenceDurationMs);
  const serverKeyStatus = usePredictionStore((s) => s.keyRotatorStatus);
  const setKeyRotatorStatus = usePredictionStore((s) => s.setKeyRotatorStatus);

  // Key Rotator status (read-only, refreshed on each render tick)
  const keyRotator = getKeyRotator();
  const rotatorStatus = serverKeyStatus ?? keyRotator.getPublicStatus();

  useEffect(() => {
    const refreshStatus = () => {
      void fetch('/api/system1', { cache: 'no-store' })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Key status endpoint returned ${response.status}`);
          const result = await response.json() as {
            status?: import('@/engine/ai/rotatorTypes').PublicRotatorStatus;
          };
          if (result.status) setKeyRotatorStatus(result.status);
        })
        .catch((error: unknown) => {
          console.warn('[KEY_ROTATOR_STATUS_UNAVAILABLE]', error);
        });
    };
    refreshStatus();
    const timer = setInterval(refreshStatus, 5000);
    return () => clearInterval(timer);
  }, [setKeyRotatorStatus]);

  // Compute cluster-wide aggregate telemetry
  let totalRps = 0;
  let totalErrorRate = 0;
  let healthyCount = 0;
  let totalNodes = CLUSTER_NODES.length;

  if (activeSnapshot) {
    const nodeEntries = Object.values(activeSnapshot.nodes);
    totalNodes = nodeEntries.length;
    for (const node of nodeEntries) {
      totalRps += node.metrics.rps;
      totalErrorRate += node.metrics.errorRatePct;
      if (node.status === 'HEALTHY') healthyCount++;
    }
    totalErrorRate = totalErrorRate / Math.max(1, totalNodes);
  } else {
    totalRps = 5240;
    totalErrorRate = 0.02;
    healthyCount = 12;
  }

  const globalStatus = activeSnapshot?.globalStatus ?? 'HEALTHY';
  const predictedRootP99 = activePrediction?.rootCauseService
    ? activeSnapshot?.nodes[activePrediction.rootCauseService]?.metrics.p99Ms ?? 0
    : 0;
  const selectedNodeTelemetry = selectedServiceId && activeSnapshot
    ? activeSnapshot.nodes[selectedServiceId]
    : null;

  // Root cause service from active incident
  const rootCauseServiceId = activePrediction?.rootCauseService ?? activeIncident?.config.rootCauseService ?? null;

  // Pull 60-tick history from the ring buffer when inspector is open
  const getServiceHistory = useCallback((): NodeTelemetry[] => {
    if (!selectedServiceId) return [];
    return getClusterSimulator().getServiceHistory(selectedServiceId);
  }, [selectedServiceId, currentTick]); // re-derive on each tick

  const serviceHistory = selectedServiceId ? getServiceHistory() : [];
  const selectAndOpenService = (serviceId: Parameters<typeof selectService>[0]) => {
    selectService(serviceId);
    if (serviceId) setIsInspectorOpen(true);
  };
  const applyRecovery = (strategy: RecoveryStrategy) => {
    getClusterSimulator().applyMitigation(strategy);
    markMitigated(getClusterSimulator().getTick());
    setSelectedRecoveryStrategy(strategy);
    onIncidentResolved?.();
  };

  return (
    <div className={`flex ${compactMode ? 'text-[90%]' : ''} ${standalone ? 'h-screen w-screen' : 'h-full w-full'} flex-col overflow-hidden bg-bg-pitch text-text-cream select-none`}>
      {/* =========================================================================
          1. HEADER BAR (h-14)
         ========================================================================= */}
      <header className="relative z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-border-cad bg-bg-panel/90 px-4 backdrop-blur-md">
        {/* Left: Brand + Track Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded border border-accent-amber/40 bg-accent-amber/10 text-accent-amber">
              <Activity className="h-4 w-4 animate-pulse" />
              <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-accent-amber" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-base font-bold tracking-widest text-text-cream">
                  CRASHLENS
                </span>
                <span className="rounded bg-accent-amber/20 px-1.5 py-0.2 font-mono text-[10px] font-semibold tracking-wider text-accent-amber">
                  SYS-1 RADAR
                </span>
              </div>
              <span className="font-mono text-[9px] tracking-wider text-text-muted">
                PREDICTIVE FAILURE INTELLIGENCE
              </span>
            </div>
          </div>

          <div className="hidden h-4 w-px bg-border-cad sm:block" />

          <span className="hidden rounded border border-border-cad bg-bg-card/60 px-2 py-0.5 font-mono text-[10px] text-text-muted sm:inline-block">
            ORCATHON 2026 // TRACK 01: SOFTWARE &amp; AI
          </span>
        </div>

        {/* Center: Global Cluster Telemetry Ribbon */}
        <div className="hidden items-center gap-3 md:flex">
          {/* Health Badge */}
          <div
            className={`flex items-center gap-2 rounded border px-2.5 py-1 transition-colors ${
              globalStatus === 'HEALTHY'
                ? 'border-radar-green/30 bg-radar-green/10 text-radar-green'
                : globalStatus === 'DEGRADED'
                ? 'border-radar-amber/40 bg-radar-amber/15 text-radar-amber'
                : 'border-radar-red/50 bg-radar-red/20 text-radar-red animate-pulse'
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${
                globalStatus === 'HEALTHY'
                  ? 'bg-radar-green animate-pulse'
                  : globalStatus === 'DEGRADED'
                  ? 'bg-radar-amber'
                  : 'bg-radar-red'
              }`}
            />
            <span className="font-mono text-xs font-semibold tracking-wider">
              {globalStatus} ({healthyCount}/{totalNodes} ONLINE)
            </span>
          </div>

          {/* Metric Calipers */}
          <div className="flex items-center gap-2 rounded border border-border-cad bg-bg-card/70 px-3 py-1 font-mono text-xs text-text-muted">
            <span>ERR:</span>
            <span
              className={`font-semibold ${
                totalErrorRate > 5.0 ? 'text-radar-red' : 'text-text-cream'
              }`}
            >
              {totalErrorRate.toFixed(2)}%
            </span>
            <span className="text-border-cad">|</span>
            <span>RPS:</span>
            <span className="font-semibold text-text-cream">
              {totalRps.toLocaleString()}
            </span>
            <span className="text-border-cad">|</span>
            <span>CLOCK:</span>
            <span className="font-semibold text-accent-amber">
              T+{currentTick.toString().padStart(2, '0')}s
            </span>
          </div>
        </div>

        {/* Right: AI Key Status + System 1 Pill */}
        <div className="flex items-center gap-2.5">
          {/* 1Hz Live Pulse */}
          <div className="hidden items-center gap-1.5 rounded border border-border-cad bg-bg-card/50 px-2 py-1 font-mono text-[11px] text-text-muted lg:flex">
            <Radio
              className={`h-3 w-3 ${
                isSimulating ? 'text-radar-green animate-pulse' : 'text-gray-500'
              }`}
            />
            <span className="text-[10px] tracking-wider">
              {isSimulating ? '1Hz LIVE' : 'PAUSED'}
            </span>
          </div>

          {/* Key Rotator Status Indicator */}
          <div
            title={rotatorStatus.slots.map((slot) => {
              const cooldown = Math.max(0, Math.ceil((slot.cooldownUntil - Date.now()) / 1000));
              return `KEY ${slot.id}: ${slot.status}${cooldown > 0 ? ` (${cooldown}s)` : ''}`;
            }).join(' · ')}
            className={`hidden items-center gap-1.5 rounded border px-2 py-1 font-mono text-[10px] lg:flex ${
              rotatorStatus.allKeysExhausted
                ? 'border-radar-red/50 bg-radar-red/10 text-radar-red'
                : rotatorStatus.readyKeysCount < 3
                ? 'border-radar-amber/40 bg-radar-amber/10 text-radar-amber'
                : 'border-border-cad bg-bg-card/50 text-text-muted'
            }`}
          >
            <Key className="h-3 w-3" />
            <span className="tracking-wider">
              {rotatorStatus.allKeysExhausted
                ? 'AI: FALLBACK TO LOCAL ENGINE'
                : rotatorStatus.slots.map((slot) => {
                    const cooldown = Math.max(0, Math.ceil((slot.cooldownUntil - Date.now()) / 1000));
                    const status = slot.status === 'COOLDOWN' && cooldown > 0
                      ? `COOLDOWN (${cooldown}s)`
                      : slot.status;
                    return `KEY ${slot.id}: ${slot.id === rotatorStatus.activeSlotId && slot.status === 'READY' ? 'ACTIVE (' + status + ')' : status}`;
                  }).join('  |  ')}
            </span>
          </div>

          {/* System 1 Decision Model Pill */}
          <div className="flex items-center gap-2 rounded border border-accent-cyan/30 bg-accent-cyan/10 px-2.5 py-1 font-mono text-xs">
            <Zap className="h-3.5 w-3.5 text-accent-cyan" />
            <span className="hidden font-medium text-accent-cyan sm:inline">
              {activePrediction?.source === 'SYSTEM_1_AI'
                ? activePrediction.model ?? 'SYSTEM 1 MODEL'
                : activePrediction?.anomalyDetected
                  ? 'TIER-0 LOCAL ENGINE'
                  : rotatorStatus.allKeysExhausted ? 'TIER-0 LOCAL ENGINE' : 'MERCURY-DECIDE: STANDBY'}
            </span>
            <span className="rounded bg-accent-cyan/20 px-1 text-[10px] text-accent-cyan">
              {lastInferenceDurationMs !== null
                ? `${lastInferenceDurationMs}MS`
                : rotatorStatus.allKeysExhausted ? 'FALLBACK' : `KEY ${rotatorStatus.activeSlotId}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowComparison(true)}
            className="hidden items-center gap-1.5 rounded border border-accent-amber/40 bg-accent-amber/10 px-2 py-1 font-mono text-[9px] font-semibold text-accent-amber transition hover:bg-accent-amber/20 disabled:cursor-not-allowed disabled:opacity-40 sm:flex"
          >
            ⚖ SAVED VS CRASHED TIMELINE
          </button>
        </div>
      </header>

      {/* =========================================================================
          2. MAIN STAGE VIEWPORT (Center Canvas + Right Inspector Rail)
         ========================================================================= */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Radar Viewport Area */}
        <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden bg-bg-pitch p-3">
          {/* Active Incident Chaos Banner */}
          {activeIncident && (
            <div className="mb-2 flex w-full max-w-4xl items-center justify-between rounded-lg border border-radar-red/60 bg-radar-red/20 px-4 py-2 text-radar-red shadow-lg backdrop-blur-md animate-pulse">
              <div className="flex items-center gap-2 font-mono text-xs">
                <Flame className="h-4 w-4" />
                <span className="font-bold">ACTIVE CHAOS DETONATION:</span>
                <span>{activeIncident.config.title}</span>
                <span className="text-white/60">
                  (Elapsed: T+{activeIncident.elapsedTicks}s)
                </span>
                {rootCauseServiceId && (
                  <span className="rounded bg-radar-red/40 px-2 py-0.5 text-[10px] font-bold">
                    ROOT: {rootCauseServiceId}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={clearIncident}
                className="flex items-center gap-1 rounded bg-radar-red/40 px-2.5 py-0.5 font-mono text-xs font-semibold text-white hover:bg-radar-red transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>CLEAR CHAOS</span>
              </button>
            </div>
          )}

          <RcaAlertBanner
            prediction={activePrediction}
            timeToCriticalRemaining={timeToCriticalRemaining}
            resolvedAtTick={isMitigated ? mitigationAppliedAtTick : null}
            globalErrorRate={totalErrorRate}
            p99Ms={predictedRootP99}
          />

          {/* 16:9 Aspect Ratio Radar Stage Canvas Container */}
          <div className="relative aspect-[16/9] w-full max-w-[1400px] max-h-[820px] rounded-lg border border-border-cad bg-bg-card/85 shadow-2xl overflow-hidden bg-cad-grid">
            {/* CAD Technical Corner Caliper Accents */}
            <div className="cad-corner-tl" />
            <div className="cad-corner-tr" />
            <div className="cad-corner-bl" />
            <div className="cad-corner-br" />

            {/* Coordinate Corner Labels */}
            <div className="absolute top-2 left-4 font-mono text-[10px] tracking-wider text-text-muted/60 pointer-events-none">
              [+000, +000]
            </div>
            <div className="absolute top-2 right-4 font-mono text-[10px] tracking-wider text-text-muted/60 pointer-events-none">
              [+1000, +000]
            </div>
            <div className="absolute bottom-2 left-4 font-mono text-[10px] tracking-wider text-text-muted/60 pointer-events-none">
              [+000, +750]
            </div>
            <div className="absolute bottom-2 right-4 font-mono text-[10px] tracking-wider text-text-muted/60 pointer-events-none">
              [+1000, +750]
            </div>

            {/* Subtle Center Crosshairs */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-25">
              <div className="h-10 w-px bg-text-cream/40" />
              <div className="w-10 h-px bg-text-cream/40 -ml-5" />
            </div>

            {/* Main Stage Topology Canvas */}
            {children ? (
              children
            ) : (
              <TopologyCanvas
                selectedServiceId={selectedServiceId}
                onSelectNode={selectAndOpenService}
                telemetrySnapshot={activeSnapshot}
                rootCauseServiceId={rootCauseServiceId}
                prediction={activePrediction}
                isMitigated={isMitigated}
              />
            )}
          </div>

          {/* =========================================================================
              3. FLOATING BOTTOM SIMULATION DOCK (h-14)
             ========================================================================= */}
          <div className="relative mt-3 flex h-14 w-full max-w-3xl items-center justify-between rounded-xl border border-border-cad-bright bg-bg-card/90 px-4 py-2 backdrop-blur-xl shadow-cad-glow">
            {/* Play/Pause & Reset Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (isSimulating ? pauseSimulation() : startSimulation())}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-all ${
                  isSimulating
                    ? 'border-accent-amber/40 bg-accent-amber/15 text-accent-amber hover:bg-accent-amber/25'
                    : 'border-border-cad bg-bg-panel/80 text-text-cream hover:bg-bg-panel'
                }`}
              >
                {isSimulating ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-current" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span>RESUME</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={resetCluster}
                className="flex items-center gap-1.5 rounded-md border border-border-cad bg-bg-panel/80 px-2.5 py-1.5 font-mono text-xs text-text-muted hover:border-border-cad-bright hover:text-text-cream transition-all"
                title="Reset Simulation State"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">RESET</span>
              </button>
            </div>

            {/* Speed Multipliers */}
            <div className="flex items-center rounded-md border border-border-cad bg-bg-panel/80 p-0.5">
              {([1, 2, 5] as const).map((speed) => (
                <button
                  key={speed}
                  type="button"
                  onClick={() => setSpeed(speed)}
                  className={`rounded px-2.5 py-1 font-mono text-xs font-medium transition-all ${
                    simulationSpeed === speed
                      ? 'bg-accent-amber text-bg-pitch font-bold'
                      : 'text-text-muted hover:text-text-cream'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>

            {/* Chaos Trigger Button + Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsChaosMenuOpen(!isChaosMenuOpen)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-mono text-xs font-semibold transition-all ${
                  activeIncident
                    ? 'border-radar-red bg-radar-red text-white animate-pulse'
                    : 'border-radar-red/40 bg-radar-red/15 text-radar-red hover:bg-radar-red/25 hover:border-radar-red'
                }`}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>{activeIncident ? 'CHAOS DETONATED' : 'INJECT CHAOS'}</span>
              </button>

              {/* Chaos Menu Dropdown */}
              {isChaosMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-80 rounded-lg border border-radar-red/40 bg-bg-card p-2 shadow-2xl backdrop-blur-xl z-50">
                  <div className="flex items-center justify-between border-b border-border-cad px-2 py-1">
                    <span className="font-mono text-[10px] tracking-wider text-text-muted">
                      SELECT DETERMINISTIC INCIDENT
                    </span>
                    {activeIncident && (
                      <button
                        type="button"
                        onClick={() => {
                          clearIncident();
                          setIsChaosMenuOpen(false);
                        }}
                        className="font-mono text-[10px] text-radar-red hover:underline"
                      >
                        CLEAR ACTIVE
                      </button>
                    )}
                  </div>

                  <div className="mt-1 flex flex-col gap-1">
                    {(Object.keys(INCIDENT_CONFIGS) as ScenarioId[]).map((scenarioId) => {
                      const cfg = INCIDENT_CONFIGS[scenarioId];
                      const isCurrent = activeIncident?.scenarioId === scenarioId;
                      return (
                        <button
                          key={scenarioId}
                          type="button"
                          onClick={() => {
                            injectIncident(scenarioId);
                            setIsChaosMenuOpen(false);
                          }}
                          className={`flex flex-col rounded p-2 text-left transition-colors ${
                            isCurrent
                              ? 'border border-radar-red bg-radar-red/20'
                              : 'hover:bg-radar-red/10'
                          }`}
                        >
                          <span className="font-mono text-xs font-semibold text-text-cream flex items-center justify-between">
                            <span>{cfg.title}</span>
                            <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] text-accent-amber">
                              {cfg.rootCauseService}
                            </span>
                          </span>
                          <span className="font-mono text-[10px] text-text-muted mt-0.5">
                            {cfg.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* =========================================================================
            4. RIGHT SIDE RAIL — Service Inspector or Cluster Overview
           ========================================================================= */}
        <aside
          className={`relative z-20 flex flex-col border-l border-border-cad bg-bg-panel/95 backdrop-blur-md transition-all duration-300 ease-in-out ${
            isInspectorOpen ? 'w-96' : 'w-10'
          }`}
        >
          {/* Toggle Tab */}
          <button
            type="button"
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className="flex h-10 w-full items-center justify-between border-b border-border-cad bg-bg-card/70 px-2.5 font-mono text-xs text-text-muted hover:text-text-cream"
          >
            {isInspectorOpen ? (
              <>
                <div className="flex items-center gap-1.5">
                  <Terminal className="h-3.5 w-3.5 text-accent-amber" />
                  <span className="font-semibold text-text-cream">
                    {selectedServiceId ? `NODE: ${selectedServiceId}` : 'CLUSTER INSPECTOR'}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </>
            ) : (
              <ChevronLeft className="h-4 w-4 mx-auto" />
            )}
          </button>

          {/* Drawer Content */}
          {isInspectorOpen && (
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* ── Service Inspector (shown when a node is selected) ─── */}
              {selectedServiceId ? (
                <ServiceInspector
                  serviceId={selectedServiceId}
                  snapshot={activeSnapshot}
                  history={serviceHistory}
                  onClose={() => selectService(null)}
                />
              ) : (
                /* ── Cluster Overview (default) ─────────────────────── */
                <div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
                  {/* Telemetry Caliper Card */}
                  <div className="rounded-lg border border-border-cad bg-bg-card/60 p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-border-cad/60 pb-1.5">
                      <span className="font-mono text-[11px] font-semibold text-accent-amber">
                        CLUSTER TELEMETRY
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[9px] ${
                          globalStatus === 'HEALTHY'
                            ? 'bg-radar-green/20 text-radar-green'
                            : globalStatus === 'DEGRADED'
                            ? 'bg-radar-amber/20 text-radar-amber'
                            : 'bg-radar-red/20 text-radar-red animate-pulse'
                        }`}
                      >
                        {globalStatus}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-text-muted">AVG ERR RATE</span>
                        <div className={`text-sm font-semibold ${totalErrorRate > 5.0 ? 'text-radar-red font-bold' : 'text-text-cream'}`}>
                          {(totalErrorRate * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted">TOTAL RPS</span>
                        <div className="text-sm font-semibold text-text-cream">
                          {totalRps.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted">HEALTHY NODES</span>
                        <div className="text-sm font-semibold text-radar-green">
                          {healthyCount}/{totalNodes}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted">SIM CLOCK</span>
                        <div className="text-sm font-semibold text-accent-amber">
                          T+{currentTick}s
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AI Recovery Advisor Placeholder */}
                  <div className="rounded-lg border border-accent-cyan/30 bg-accent-cyan/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="h-4 w-4 text-accent-cyan" />
                        <span className="font-mono text-xs font-semibold text-accent-cyan">
                          SYSTEM 1 ADVISOR
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-text-muted">
                        {activeIncident ? 'ANOMALY DETECTED' : 'STANDBY'}
                      </span>
                    </div>
                    <p className="font-mono text-[11px] leading-relaxed text-text-muted">
                      {activeIncident
                        ? `Impending breach triggered by ${activeIncident.config.rootCauseService}. System 1 reflexive engine will isolate blast radius in < 400ms.`
                        : 'Dual-tier failure prediction engine listening to 1Hz vector stream. Click any node to inspect live telemetry and sparklines.'}
                    </p>
                  </div>

                  {/* Cluster Nodes Quick Index */}
                  <div className="rounded-lg border border-border-cad bg-bg-card/40 p-3 space-y-2">
                    <div className="flex items-center justify-between border-b border-border-cad/60 pb-1">
                      <span className="font-mono text-[11px] font-semibold text-text-cream">
                        TOPOLOGY DIRECTORY
                      </span>
                      <span className="font-mono text-[10px] text-text-muted">
                        {CLUSTER_NODES.length} NODES
                      </span>
                    </div>
                    <div className="space-y-1 font-mono text-[11px]">
                      {CLUSTER_NODES.map((node) => {
                        const tele = activeSnapshot?.nodes[node.id];
                        const isSelected = selectedServiceId === node.id;
                        const p99 = tele?.metrics.p99Ms ?? node.baselines.p99Ms;
                        const status = tele?.status ?? 'HEALTHY';
                        return (
                          <div
                            key={node.id}
                            onClick={() => selectAndOpenService(isSelected ? null : node.id)}
                            className={`flex justify-between py-1 px-1.5 rounded cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-accent-amber/20 text-accent-amber'
                                : 'hover:bg-white/5 text-text-muted'
                            }`}
                          >
                            <span className="truncate">{node.id}</span>
                            <span
                              className={
                                status === 'HEALTHY'
                                  ? 'text-radar-green'
                                  : status === 'DEGRADED'
                                  ? 'text-radar-amber'
                                  : 'text-radar-red'
                              }
                            >
                              {p99}ms
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {isInspectorOpen && activePrediction?.anomalyDetected && (
            <RecoveryAdvisorPanel
              prediction={activePrediction}
              isMitigated={isMitigated}
              onApply={applyRecovery}
            />
          )}
        </aside>
      </div>
      {showComparison && activeIncident && (
        <SavedVsCrashedViewer
          scenarioId={activeIncident.scenarioId}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
