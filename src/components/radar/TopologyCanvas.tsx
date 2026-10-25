'use client';

import React from 'react';
import {
  CLUSTER_NODES,
  CLUSTER_EDGES,
  CLUSTER_NODE_MAP,
} from '@/engine/topology/clusterTopology';
import { TopologyNodeItem } from './TopologyNodeItem';
import { AnimatedEdge } from './AnimatedEdge';
import { BlastRadiusRipple } from './BlastRadiusRipple';
import type { ServiceId, ServiceStatus } from '@/types/topology';
import type { ClusterTelemetrySnapshot } from '@/types/telemetry';
import type { PredictionResult } from '@/types/prediction';
import { CulpritCrosshair } from './CulpritCrosshair';

interface TopologyCanvasProps {
  selectedServiceId?: ServiceId | null;
  onSelectNode?: (serviceId: ServiceId) => void;
  telemetrySnapshot?: ClusterTelemetrySnapshot | null;
  /** Root-cause service when blast radius is active */
  rootCauseServiceId?: ServiceId | null;
  prediction?: PredictionResult | null;
  isMitigated?: boolean;
}

export function TopologyCanvas({
  selectedServiceId = null,
  onSelectNode,
  telemetrySnapshot,
  rootCauseServiceId,
  prediction,
  isMitigated = false,
}: TopologyCanvasProps) {
  // Determine blast radius culprit position
  const rootCauseNode = rootCauseServiceId ? CLUSTER_NODE_MAP[rootCauseServiceId] : null;

  return (
    <svg
      viewBox="0 0 1000 750"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full select-none"
    >
      <defs>
        {/* Default arrowhead */}
        <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="rgba(255, 237, 214, 0.25)" />
        </marker>
        {/* Amber arrowhead for degraded edges */}
        <marker id="arrowhead-amber" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="#ff8539" />
        </marker>
        {/* Red arrowhead for saturated edges */}
        <marker id="arrowhead-red" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="#ef4444" />
        </marker>
        {/* Cyan arrowhead for active/selected edges */}
        <marker id="arrowhead-cyan" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill="#38bdf8" />
        </marker>
      </defs>

      {/* =====================================================================
          LAYER 0 (BOTTOM): BLAST RADIUS RIPPLE (below edges)
         ===================================================================== */}
      {rootCauseNode && (
        <BlastRadiusRipple
          cx={rootCauseNode.x}
          cy={rootCauseNode.y}
          active={!!prediction?.anomalyDetected && !isMitigated}
        />
      )}

      {/* =====================================================================
          LAYER 1: DEPENDENCY EDGES with animated particles
         ===================================================================== */}
      <g id="layer-edges">
        {CLUSTER_EDGES.map((edge) => {
          const edgeTelemetry = telemetrySnapshot?.edges[edge.id];
          const isEdgeActive =
            selectedServiceId === edge.source || selectedServiceId === edge.target;

          return (
            <AnimatedEdge
              key={edge.id}
              edge={edge}
              telemetry={edgeTelemetry}
              isActive={isEdgeActive}
              isCascade={!isMitigated && !!prediction?.anomalyDetected && (
                edge.target === prediction.rootCauseService ||
                (prediction.blastRadiusServices.includes(edge.source) &&
                  prediction.blastRadiusServices.includes(edge.target))
              )}
              isMitigated={isMitigated}
            />
          );
        })}
      </g>

      {/* =====================================================================
          LAYER 2 (TOP): TOPOLOGY SERVICE NODES
         ===================================================================== */}
      <g id="layer-nodes">
        {CLUSTER_NODES.map((node) => {
          const nodeTelemetry = telemetrySnapshot?.nodes[node.id];
          const status: ServiceStatus = nodeTelemetry?.status ?? 'HEALTHY';
          const p99Ms = nodeTelemetry?.metrics.p99Ms ?? node.baselines.p99Ms;
          const cpuPct = nodeTelemetry?.metrics.cpuPct ?? node.baselines.cpuPct;

          return (
            <TopologyNodeItem
              key={node.id}
              node={node}
              isSelected={selectedServiceId === node.id}
              status={status}
              p99Ms={p99Ms}
              cpuPct={cpuPct}
              onSelect={onSelectNode}
            />
          );
        })}
      </g>
      {prediction?.anomalyDetected && prediction.rootCauseService && (
        <CulpritCrosshair serviceId={prediction.rootCauseService} resolved={isMitigated} />
      )}
    </svg>
  );
}
