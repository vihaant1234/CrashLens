/**
 * SVG Geometry Helpers for CrashLens Radar
 * Calculates smooth cubic bezier curves for DAG dependency flow and edge connections.
 */

import { TopologyNode } from '@/types/topology';

/**
 * Computes a smooth cubic bezier curve path string between two coordinates:
 * M(x1, y1) C(x1, y1 + dy/2, x2, y2 - dy/2, x2, y2)
 */
export function computeBezierPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dy = y2 - y1;
  const cy1 = y1 + dy * 0.5;
  const cy2 = y2 - dy * 0.5;

  return `M ${x1} ${y1} C ${x1} ${cy1}, ${x2} ${cy2}, ${x2} ${y2}`;
}

/**
 * Calculates connecting boundary points between source (bottom) and target (top) node cards.
 * Node card dimensions: 140px width x 64px height, centered at (node.x, node.y).
 */
export function getNodeConnectorPoints(
  source: TopologyNode,
  target: TopologyNode,
  nodeWidth: number = 140,
  nodeHeight: number = 64
): { x1: number; y1: number; x2: number; y2: number } {
  // If target is strictly below source (standard DAG flow)
  if (target.y > source.y) {
    return {
      x1: source.x,
      y1: source.y + nodeHeight / 2,
      x2: target.x,
      y2: target.y - nodeHeight / 2,
    };
  }

  // Fallback for horizontal or lateral connections
  const dx = target.x - source.x;
  return {
    x1: dx > 0 ? source.x + nodeWidth / 2 : source.x - nodeWidth / 2,
    y1: source.y,
    x2: dx > 0 ? target.x - nodeWidth / 2 : target.x + nodeWidth / 2,
    y2: target.y,
  };
}
