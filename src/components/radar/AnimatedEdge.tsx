'use client';

import React, { useId } from 'react';
import type { TopologyEdge } from '@/types/topology';
import type { EdgeTelemetry } from '@/types/telemetry';
import { computeBezierPath, getNodeConnectorPoints } from './svgHelpers';
import { CLUSTER_NODE_MAP } from '@/engine/topology/clusterTopology';

interface AnimatedEdgeProps {
  edge: TopologyEdge;
  telemetry?: EdgeTelemetry;
  isActive?: boolean;
  isCascade?: boolean;
  isMitigated?: boolean;
}

/**
 * Renders a single animated dependency edge:
 * - Base bezier path with dynamic color (healthy → degraded → saturated)
 * - Flowing animated packet particles along the path
 * - Red dissolving particles when error rate > 10%
 */
export function AnimatedEdge({
  edge,
  telemetry,
  isActive = false,
  isCascade = false,
  isMitigated = false,
}: AnimatedEdgeProps) {
  const uid = useId().replace(/:/g, '');
  const sourceNode = CLUSTER_NODE_MAP[edge.source];
  const targetNode = CLUSTER_NODE_MAP[edge.target];

  if (!sourceNode || !targetNode) return null;

  const points = getNodeConnectorPoints(sourceNode, targetNode);
  const pathD = computeBezierPath(points.x1, points.y1, points.x2, points.y2);

  // Derive severity from telemetry
  const errorRate = telemetry?.errorRatePct ?? 0;
  const saturation = telemetry?.saturationScore ?? 0;
  const latency = telemetry?.latencyMs ?? 0;

  const isSaturated = errorRate > 0.10 || saturation > 0.85;
  const isDegraded = !isSaturated && (errorRate > 0.02 || saturation > 0.5 || latency > 150);

  // Edge stroke color
  const strokeColor = isMitigated
    ? '#38bdf8'
    : isCascade
    ? '#ff8539'
    : isSaturated
    ? '#ef4444'
    : isDegraded
    ? '#ff8539'
    : isActive
    ? 'rgba(56,189,248,0.75)'
    : 'rgba(255, 237, 214, 0.18)';

  const strokeWidth = isCascade ? 3 : isActive ? 2.4 : isSaturated || isDegraded ? 2.0 : 1.4;

  // Particle color
  const particleColor = isMitigated ? '#38bdf8' : isCascade ? '#ff8539' : isSaturated ? '#ef4444' : isDegraded ? '#ff8539' : '#38bdf8';

  // Arrowhead marker id
  const arrowId = isMitigated || (!isCascade && !isSaturated && !isDegraded && isActive)
    ? 'arrowhead-cyan'
    : isCascade
    ? 'arrowhead-amber'
    : isSaturated
    ? 'arrowhead-red'
    : isDegraded
    ? 'arrowhead-amber'
    : isActive
    ? 'arrowhead-cyan'
    : 'arrowhead';

  // Number of particle streams (more = busier edge)
  const particleCount = isSaturated ? 4 : isDegraded ? 3 : 2;

  // Base animation duration — faster when saturated
  const baseDuration = isSaturated ? 1.0 : isDegraded ? 1.4 : 1.8;

  return (
    <g id={`edge-${uid}`} className="group">
      {/* Invisible wide hit area */}
      <path d={pathD} fill="none" stroke="transparent" strokeWidth={14} />

      {/* Glowing halo under stressed edges */}
      {(isDegraded || isSaturated) && (
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth + 5}
          opacity={0.12}
        />
      )}

      {/* Main bezier path */}
      <path
        d={pathD}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={isCascade ? '6 4' : edge.criticality === 'LOW' ? '5 4' : undefined}
        markerEnd={`url(#${arrowId})`}
        style={{ transition: 'stroke 0.6s ease, stroke-width 0.3s ease' }}
      />

      {/* Animated flow particles */}
      {Array.from({ length: particleCount }).map((_, i) => {
        const delay = (i / particleCount) * baseDuration;
        const duration = baseDuration + (i % 3) * 0.15;
        const r = isSaturated ? 2.8 : 2.2;

        return (
          <circle
            key={i}
            r={r}
            fill={particleColor}
            opacity={0}
            style={{ filter: `drop-shadow(0 0 3px ${particleColor})` }}
          >
            <animateMotion
              dur={`${duration}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
              path={pathD}
            />
            {/* Fade in and out along trajectory */}
            <animate
              attributeName="opacity"
              values="0;0.9;0.9;0"
              keyTimes="0;0.1;0.85;1"
              dur={`${duration}s`}
              begin={`${delay}s`}
              repeatCount="indefinite"
            />
            {/* Dissolve early if error rate is high (packets dropping) */}
            {isSaturated && !isMitigated && (
              <animate
                attributeName="r"
                values={`${r};${r};0`}
                keyTimes="0;0.65;1"
                dur={`${duration}s`}
                begin={`${delay}s`}
                repeatCount="indefinite"
              />
            )}
          </circle>
        );
      })}
    </g>
  );
}
