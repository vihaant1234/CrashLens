const EPSILON = 1e-6;

export function computeRollingZScore(currentVal: number, history: number[]): number {
  const samples = history.filter(Number.isFinite);
  if (!Number.isFinite(currentVal) || samples.length < 2) return 0;

  const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  const variance =
    samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    samples.length;
  const zScore = (currentVal - mean) / (Math.sqrt(variance) + EPSILON);

  return Math.max(-3, Math.min(15, zScore));
}
