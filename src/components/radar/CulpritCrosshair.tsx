import type { ServiceId } from '@/types/topology';
import { CLUSTER_NODE_MAP } from '@/engine/topology/clusterTopology';

interface CulpritCrosshairProps {
  serviceId: ServiceId;
  resolved?: boolean;
}

export function CulpritCrosshair({ serviceId, resolved = false }: CulpritCrosshairProps) {
  const node = CLUSTER_NODE_MAP[serviceId];
  if (!node) return null;
  const x = node.x - 74;
  const y = node.y - 38;
  const color = resolved ? '#22c55e' : '#ff8539';

  return (
    <g
      pointerEvents="none"
      style={{ color, filter: `drop-shadow(0 0 8px ${resolved ? 'rgba(34,197,94,0.8)' : 'rgba(255,133,57,0.8)'})` }}
    >
      <rect x={x} y={y} width={148} height={76} rx={9} fill="none" stroke={color} strokeWidth={2} strokeDasharray="8 4" className={resolved ? '' : 'animate-pulse'} />
      <path d={`M${x} ${y + 12}V${y}H${x + 14} M${x + 134} ${y}H${x + 148}V${y + 12} M${x} ${y + 64}V${y + 76}H${x + 14} M${x + 134} ${y + 76}H${x + 148}V${y + 64}`} fill="none" stroke={color} strokeWidth={3} />
      <rect x={x} y={y - 16} width={154} height={12} rx={2} fill="#07080a" opacity={0.9} />
      <text x={x + 3} y={y - 7} fontFamily="monospace" fontSize={8} fill={color}>
        [CULPRIT: {Math.round(node.x)}, {Math.round(node.y)}]
      </text>
    </g>
  );
}
