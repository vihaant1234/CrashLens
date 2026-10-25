'use client';

import React, { useEffect, useRef } from 'react';

interface BlastRadiusRippleProps {
  /** SVG canvas coordinates of the culprit node */
  cx: number;
  cy: number;
  /** Whether to render ripples */
  active: boolean;
}

const MAX_RADIUS = 180;
const INITIAL_RADIUS = 24;
const RING_COUNT = 3;
const PERIOD_MS = 2500; // Full cycle time

/**
 * Renders expanding concentric amber dashed ripple rings emanating from
 * the root-cause node, representing the cascade blast wavefront.
 *
 * Uses requestAnimationFrame for 60fps rendering decoupled from React re-renders.
 */
export function BlastRadiusRipple({ cx, cy, active }: BlastRadiusRippleProps) {
  const ringsRef = useRef<SVGGElement | null>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(performance.now());

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    startRef.current = performance.now();

    const animate = (now: number) => {
      const g = ringsRef.current;
      if (!g) return;

      const elapsed = now - startRef.current;

      const circles = g.querySelectorAll<SVGCircleElement>('circle[data-ring]');
      circles.forEach((circle) => {
        const ringIndex = Number(circle.getAttribute('data-ring'));
        // Stagger each ring by (PERIOD_MS / RING_COUNT) * ringIndex
        const offset = (PERIOD_MS / RING_COUNT) * ringIndex;
        const t = ((elapsed + offset) % PERIOD_MS) / PERIOD_MS; // 0..1

        const radius = INITIAL_RADIUS + (MAX_RADIUS - INITIAL_RADIUS) * t;
        const opacity = Math.max(0, 1 - t) * 0.85;

        circle.setAttribute('r', String(radius));
        circle.setAttribute('opacity', String(opacity));
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  if (!active) return null;

  return (
    <g ref={ringsRef} id="blast-radius-ripple" pointerEvents="none">
      {/* Central hotspot glow */}
      <circle
        cx={cx}
        cy={cy}
        r={20}
        fill="rgba(255, 42, 85, 0.15)"
        style={{ filter: 'blur(4px)' }}
      />
      <circle
        cx={cx}
        cy={cy}
        r={10}
        fill="rgba(255, 133, 57, 0.35)"
        style={{ filter: 'blur(2px)' }}
      />

      {/* Expanding concentric ripple rings */}
      {Array.from({ length: RING_COUNT }).map((_, i) => (
        <circle
          key={i}
          data-ring={i}
          cx={cx}
          cy={cy}
          r={INITIAL_RADIUS}
          fill="none"
          stroke="#ff8539"
          strokeWidth={1.5}
          strokeDasharray="8 5"
          opacity={0}
        />
      ))}

      {/* Static root-cause indicator ring */}
      <circle
        cx={cx}
        cy={cy}
        r={28}
        fill="none"
        stroke="#ef4444"
        strokeWidth={2}
        strokeDasharray="4 3"
        opacity={0.7}
      />

      {/* ROOT CAUSE label */}
      <text
        x={cx}
        y={cy - 36}
        textAnchor="middle"
        fontFamily="monospace"
        fontSize={9}
        fill="#ff8539"
        opacity={0.9}
        letterSpacing={1}
      >
        ◉ ROOT CAUSE
      </text>
    </g>
  );
}
