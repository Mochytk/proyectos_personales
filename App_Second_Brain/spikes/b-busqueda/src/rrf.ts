// Reciprocal Rank Fusion: score(d) = sum over lists of 1 / (k + rank). No score calibration needed.

export function rrf(lists: string[][], k = 60): string[] {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return [...scores].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
