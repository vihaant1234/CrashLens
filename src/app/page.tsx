import { SimulationController } from '@/engine/simulator/SimulationController';
import { RadarShell } from '@/components/radar/RadarShell';

export default function HomePage() {
  return (
    <SimulationController autoStart={true}>
      <RadarShell />
    </SimulationController>
  );
}
