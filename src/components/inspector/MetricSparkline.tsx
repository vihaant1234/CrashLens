'use client';

import React, { useMemo } from 'react';

interface MetricSparklineProps {
  /** Ordered series (oldest → newest), up to 60 values */
  data: number[];
  /** Stroke color, defaults to accent-amber */
  color?: string;
  /** Fill gradient color, defaults to same as color with low opacity */
  fillColor?: string;
  /** SVG canvas height in px */
  height?: number;
  /** Baseline threshold value drawn as a dashed reference line */
  baseline?: number;
  /** Label shown at the right tip of the sparkline */
  label?: string;
}

/**
 * Lightweight SVG sparkline with area fill and baseline dashed reference line.
 * No external dependencies — pure math normalization.
 */
export function MetricSparkline({
  data,
  color = '#ff8539',
  fillColor,
  height = 42,
  baseline,
  label,
}: MetricSparklineProps) {
  const width = 240; // intrinsic SVG width (responsive via viewBox)

  const { polylinePoints, baselineY, areaPath, hasData } = useMemo(() => {
    if (!data || data.length < 2) {
      return { polylinePoints: '', baselineY: null, areaPath: '', hasData: false };
    }

    const series = data.slice(-60); // Ensure at most 60 points
    const n = series.length;
    const minVal = Math.min(...series);
    const maxVal = Math.max(...series);
    const range = maxVal - minVal + 1e-6; // ε to avoid division by zero

    const xStep = width / (n - 1);

    // Normalise: y=0 is top of SVG, y=height is bottom
    const toY = (v: number) => height - ((v - minVal) / range) * (height - 4) - 2;

    const points = series.map((v, i) => `${(i * xStep).toFixed(1)},${toY(v).toFixed(1)}`);
    const polylinePoints = points.join(' ');

    // Area closed path (polygon)
    const areaPath =
      `M 0 ${height} ` +
      series.map((v, i) => `L ${(i * xStep).toFixed(1)} ${toY(v).toFixed(1)}`).join(' ') +
      ` L ${((n - 1) * xStep).toFixed(1)} ${height} Z`;

    // Baseline dashed line
    let baselineY: number | null = null;
    if (baseline !== undefined) {
      baselineY = toY(baseline);
    }

    return { polylinePoints, baselineY, areaPath, hasData: true };
  }, [data, height, width, baseline]);

  const resolvedFill = fillColor ?? color;

  if (!hasData) {
    return (
      <div
        className="flex items-center justify-center rounded"
        style={{ width: '100%', height }}
      >
        <span className="font-mono text-[10px] text-text-muted">NO DATA</span>
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
      >
        <defs>
          <linearGradient id={`sg-${color.replace('#', '')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={resolvedFill} stopOpacity={0.35} />
            <stop offset="100%" stopColor={resolvedFill} stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={areaPath}
          fill={`url(#sg-${color.replace('#', '')})`}
        />

        {/* Baseline reference */}
        {baselineY !== null && (
          <>
            <line
              x1={0}
              y1={baselineY}
              x2={width}
              y2={baselineY}
              stroke={color}
              strokeWidth={0.8}
              strokeDasharray="3 3"
              opacity={0.45}
            />
            {label && (
              <text
                x={width - 2}
                y={baselineY - 2}
                textAnchor="end"
                fontFamily="monospace"
                fontSize={7}
                fill={color}
                opacity={0.6}
              >
                baseline
              </text>
            )}
          </>
        )}

        {/* Sparkline polyline */}
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Live tip dot */}
        {(() => {
          if (!data || data.length < 2) return null;
          const series = data.slice(-60);
          const n = series.length;
          const xStep = width / (n - 1);
          const minVal = Math.min(...series);
          const maxVal = Math.max(...series);
          const range = maxVal - minVal + 1e-6;
          const lastX = (n - 1) * xStep;
          const lastY = height - ((series[n - 1] - minVal) / range) * (height - 4) - 2;
          return (
            <circle
              cx={lastX}
              cy={lastY}
              r={2.5}
              fill={color}
              opacity={0.9}
            />
          );
        })()}
      </svg>

      {/* Live current value label */}
      {label && (
        <span
          className="absolute right-0 top-0 font-mono text-[10px] font-semibold"
          style={{ color }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
