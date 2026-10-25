'use client';

import { Pause, Play, RotateCcw } from 'lucide-react';

const MILESTONES = [
  { tick: 12, title: 'AI FLAG' },
  { tick: 14, title: 'MITIGATION' },
  { tick: 28, title: 'PAGER' },
  { tick: 34, title: 'GATEWAY' },
];

interface TimelineScrubberProps {
  value: number;
  max: number;
  isPlaying: boolean;
  onChange: (value: number) => void;
  onTogglePlay: () => void;
  onReplay: () => void;
}

export function TimelineScrubber({
  value,
  max,
  isPlaying,
  onChange,
  onTogglePlay,
  onReplay,
}: TimelineScrubberProps) {
  return (
    <div className="border-t border-white/10 bg-black/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onTogglePlay} aria-label={isPlaying ? 'Pause timeline' : 'Play timeline'} className="rounded border border-white/15 p-2 text-text-cream hover:border-accent-amber/50">
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button type="button" onClick={onReplay} aria-label="Replay timeline" className="rounded border border-white/15 p-2 text-text-muted hover:text-text-cream" title="Replay timeline">
          <RotateCcw className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={max}
            value={value}
            aria-label="Counterfactual timeline position"
            onChange={(event) => onChange(Number(event.target.value))}
            className="w-full accent-accent-amber"
          />
          <div className="relative mt-1 h-5">
            {MILESTONES.map((milestone) => (
              <span
                key={milestone.tick}
                className="absolute -translate-x-1/2 whitespace-nowrap font-mono text-[8px] text-text-muted"
                style={{ left: `${(milestone.tick / max) * 100}%` }}
              >
                T+{milestone.tick} {milestone.title}
              </span>
            ))}
          </div>
        </div>
        <span className="min-w-20 text-right font-mono text-[10px] text-text-cream">T+{value}s / T+{max}s</span>
      </div>
    </div>
  );
}
