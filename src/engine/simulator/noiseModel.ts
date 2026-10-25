/**
 * Gaussian Noise and Telemetry Metric Fluctuations
 * Generates realistic statistical distributions with log-normal latency tails.
 */

/**
 * Box-Muller transform to produce normally distributed random numbers.
 */
export function gaussianRandom(mean: number, stdDev: number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();

  const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + num * stdDev;
}

/**
 * Generates a metric centered around a baseline with gaussian variance, bounded by [minVal, maxVal].
 */
export function generateBaselineMetric(
  baseline: number,
  variancePct: number,
  minVal: number,
  maxVal: number
): number {
  if (!Number.isFinite(baseline) || !Number.isFinite(variancePct) || variancePct < 0) {
    throw new RangeError('Baseline and variance must be finite, with non-negative variance');
  }
  if (!Number.isFinite(minVal) || !Number.isFinite(maxVal) || minVal > maxVal) {
    throw new RangeError('Metric bounds must be finite and minVal must not exceed maxVal');
  }
  const stdDev = Math.max(0.1, baseline * variancePct);
  const raw = gaussianRandom(baseline, stdDev);
  const clamped = Math.min(maxVal, Math.max(minVal, raw));
  return Number(clamped.toFixed(2));
}

/**
 * Generates p99 latency with mostly Gaussian jitter and a rare log-normal tail.
 * Even healthy services occasionally see network micro-jitters.
 */
export function generateLatencyMetric(
  baseline: number,
  variancePct: number = 0.12,
  minVal: number = 1
): number {
  if (!Number.isFinite(baseline) || baseline < 0) {
    throw new RangeError('Latency baseline must be a finite non-negative number');
  }
  if (!Number.isFinite(variancePct) || variancePct < 0) {
    throw new RangeError('Latency variance must be a finite non-negative number');
  }
  if (!Number.isFinite(minVal) || minVal < 0) {
    throw new RangeError('Minimum latency must be a finite non-negative number');
  }

  const isTailSpike = Math.random() < 0.07;
  const stdDev = Math.max(0.5, baseline * variancePct);
  const typicalLatency = gaussianRandom(baseline, stdDev);
  const logNormalMultiplier = Math.exp(gaussianRandom(0.2, 0.22));
  const raw = isTailSpike ? typicalLatency * logNormalMultiplier : typicalLatency;
  return Math.max(minVal, Math.round(raw));
}
