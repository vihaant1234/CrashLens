'use client';

import { SimulationController } from '@/engine/simulator/SimulationController';
import { RadarShell } from './RadarShell';
import type { ScenarioId } from '@/types/incidents';

export interface CrashLensRadarProps {
  standalone?: boolean;
  initialScenario?: ScenarioId;
  compactMode?: boolean;
  apiKeys?: [string, string, string];
  onIncidentResolved?: () => void;
}

export function CrashLensRadar({
  standalone = true,
  initialScenario,
  compactMode = false,
  apiKeys,
  onIncidentResolved,
}: CrashLensRadarProps) {
  return (
    <div className={standalone ? 'h-screen w-screen' : 'h-full w-full'} data-crashlens-radar>
      <SimulationController
        autoStart
        initialScenario={initialScenario}
        apiKeys={apiKeys}
      >
        <RadarShell
          standalone={standalone}
          compactMode={compactMode}
          onIncidentResolved={onIncidentResolved}
        />
      </SimulationController>
    </div>
  );
}
