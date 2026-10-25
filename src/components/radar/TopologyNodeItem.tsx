'use client';

import React from 'react';
import {
  Globe,
  Lock,
  ShoppingCart,
  Sparkles,
  Package,
  HardDrive,
  CreditCard,
  Box,
  Bell,
  Database,
  ShieldAlert,
  Server,
  Activity,
  LucideIcon,
  AlertTriangle,
} from 'lucide-react';
import type { TopologyNode, ServiceId, ServiceStatus } from '@/types/topology';

interface TopologyNodeItemProps {
  node: TopologyNode;
  isSelected?: boolean;
  status?: ServiceStatus;
  p99Ms?: number;
  cpuPct?: number;
  onSelect?: (serviceId: ServiceId) => void;
}

// Icon mapping per microservice ID
const SERVICE_ICONS: Record<ServiceId, LucideIcon> = {
  'api-gateway': Globe,
  'auth-svc': Lock,
  cart: ShoppingCart,
  recommendations: Sparkles,
  'orders-svc': Package,
  'redis-cache': HardDrive,
  'payments-svc': CreditCard,
  inventory: Box,
  'notification-svc': Bell,
  'payments-db': Database,
  'fraud-svc': ShieldAlert,
  'warehouse-db': Server,
  'kafka-broker': Activity,
};

export function TopologyNodeItem({
  node,
  isSelected = false,
  status = 'HEALTHY',
  p99Ms,
  cpuPct,
  onSelect,
}: TopologyNodeItemProps) {
  const Icon = SERVICE_ICONS[node.id] || Server;
  const currentP99 = p99Ms ?? node.baselines.p99Ms;
  const currentCpu = cpuPct ?? node.baselines.cpuPct;

  const nodeWidth = 140;
  const nodeHeight = 68; // Slightly taller to show CPU row
  const topLeftX = node.x - nodeWidth / 2;
  const topLeftY = node.y - nodeHeight / 2;

  // ── Status visual config ──────────────────────────────────────────────────
  const statusConfig: Record<ServiceStatus, {
    dotColor: string;
    glowClass: string;
    textColor: string;
    borderCss: string;
    labelText: string;
  }> = {
    HEALTHY: {
      dotColor: 'bg-radar-green',
      glowClass: 'shadow-[0_0_8px_rgba(0,255,136,0.4)]',
      textColor: 'text-radar-green',
      borderCss: isSelected
        ? 'border-accent-amber shadow-amber-glow'
        : 'border-white/10 hover:border-accent-amber/60',
      labelText: 'OK',
    },
    DEGRADED: {
      dotColor: 'bg-radar-amber',
      glowClass: 'shadow-[0_0_12px_rgba(255,170,64,0.6)] animate-pulse',
      textColor: 'text-radar-amber',
      borderCss: 'border-radar-amber shadow-[0_0_15px_rgba(255,133,57,0.4)]',
      labelText: 'WARN',
    },
    CRITICAL: {
      dotColor: 'bg-radar-red',
      glowClass: 'shadow-[0_0_15px_rgba(255,42,85,0.8)]',
      textColor: 'text-radar-red',
      borderCss: 'border-radar-red shadow-[0_0_22px_rgba(255,42,85,0.55)]',
      labelText: 'CRIT',
    },
    DEAD: {
      dotColor: 'bg-gray-600',
      glowClass: '',
      textColor: 'text-gray-500',
      borderCss: 'border-gray-700 opacity-60',
      labelText: 'DEAD',
    },
  };

  const cfg = statusConfig[status];

  // ── DEAD banner overlay ───────────────────────────────────────────────────
  const showDeadBanner = status === 'DEAD';
  // Rapid pulsing glow for CRITICAL
  const criticalRing = status === 'CRITICAL'
    ? 'ring-1 ring-radar-red/70 animate-pulse'
    : '';

  return (
    <foreignObject
      x={topLeftX}
      y={topLeftY}
      width={nodeWidth}
      height={nodeHeight}
      className="overflow-visible"
    >
      <button
        type="button"
        onClick={() => onSelect?.(node.id)}
        aria-label={`Inspect ${node.name}, status ${status}, p99 latency ${currentP99} milliseconds`}
        className={`group relative flex h-full w-full cursor-pointer flex-col justify-between rounded-lg border bg-[#0d0f16]/92 p-2 text-left backdrop-blur-md transition-all duration-300 select-none hover:scale-[1.03] ${cfg.borderCss} ${
          isSelected ? 'ring-1 ring-accent-amber' : criticalRing
        }`}
      >
        {/* DEAD service timeout banner */}
        {showDeadBanner && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-gray-900/70 backdrop-blur-sm">
            <span className="font-mono text-[9px] font-bold tracking-widest text-gray-400 uppercase">
              [SERVICE TIMEOUT]
            </span>
          </div>
        )}

        {/* Header: Icon + Service Name */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <div
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors ${
              status === 'CRITICAL'
                ? 'bg-radar-red/20 text-radar-red'
                : status === 'DEGRADED'
                ? 'bg-radar-amber/20 text-radar-amber'
                : 'bg-white/5 text-accent-amber group-hover:text-text-cream'
            }`}
          >
            {status === 'CRITICAL' ? (
              <AlertTriangle className="h-3 w-3 animate-pulse" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
          </div>
          <span className="truncate font-mono text-[10.5px] font-semibold tracking-wide text-text-cream group-hover:text-accent-amber transition-colors">
            {node.name}
          </span>
        </div>

        {/* Metrics row: p99 + CPU */}
        <div className="flex items-center gap-2 border-t border-white/5 pt-1 font-mono text-[10px]">
          <span className="text-text-muted">
            <span
              className={`font-semibold ${
                status === 'CRITICAL'
                  ? 'text-radar-red'
                  : status === 'DEGRADED'
                  ? 'text-radar-amber'
                  : 'text-text-cream'
              }`}
            >
              {currentP99}
            </span>
            <span className="text-[9px]">ms</span>
          </span>
          <span className="text-text-muted">|</span>
          <span className="text-text-muted">
            <span
              className={`font-semibold ${
                currentCpu > 80 ? 'text-radar-red' : 'text-text-cream'
              }`}
            >
              {Math.round(currentCpu)}
            </span>
            <span className="text-[9px]">%</span>
          </span>

          {/* Status badge + dot — pushed right */}
          <div className="ml-auto flex items-center gap-1">
            <span className={`text-[9px] uppercase tracking-wider ${cfg.textColor}`}>
              {cfg.labelText}
            </span>
            <span className="relative flex h-2 w-2">
              <span
                className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.dotColor} ${cfg.glowClass}`}
              />
              <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dotColor}`} />
            </span>
          </div>
        </div>
      </button>
    </foreignObject>
  );
}
