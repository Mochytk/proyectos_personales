// recall@k and reciprocal rank for one question; averages for a run.

export function recallAt(expected: string[], ranked: string[], k: number): number {
  const top = new Set(ranked.slice(0, k));
  return expected.filter((id) => top.has(id)).length / expected.length;
}

export function reciprocalRank(expected: string[], ranked: string[]): number {
  const index = ranked.findIndex((id) => expected.includes(id));
  return index === -1 ? 0 : 1 / (index + 1);
}

export function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? Number.NaN;
}
