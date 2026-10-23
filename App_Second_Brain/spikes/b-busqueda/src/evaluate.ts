// Runs every golden question through one search method and computes recall@5, MRR and latency.
import type { Note, Question } from './corpus.ts';
import { type DateRange, inRange, relativeRange } from './dates.ts';
import { mean, percentile, recallAt, reciprocalRank } from './metrics.ts';

export type Search = (query: string, k: number) => Promise<string[]> | string[];

export interface MethodResult {
  method: string;
  recall5: number;
  mrr: number;
  p50ms: number;
  p95ms: number;
  byCategory: Record<string, number>;
  misses: string[];
}

export async function evaluate(
  method: string,
  questions: Question[],
  notes: Note[],
  search: Search,
  { dates }: { dates: boolean },
): Promise<MethodResult> {
  const created = new Map(notes.map((note) => [note.id, note.createdAt]));
  const newestFirst = [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latencies: number[] = [];
  const recalls: number[] = [];
  const ranks: number[] = [];
  const byCategory = new Map<string, number[]>();
  const misses: string[] = [];

  for (const question of questions) {
    let text = question.pregunta;
    let range: DateRange | null = null;
    if (dates && question.fecha_ref) {
      range = relativeRange(text, question.fecha_ref);
      if (range) text = text.toLowerCase().replace(range.phrase, ' ');
    }
    const started = performance.now();
    let ranked = await search(text, range ? 50 : 20);
    if (range) {
      const window = range;
      ranked = ranked.filter((id) => inRange(created.get(id) ?? '', window));
      // "¿Qué anoté ayer?" has no topic words left: list that day's notes, newest first.
      if (ranked.length === 0) ranked = newestFirst.filter((note) => inRange(note.createdAt, window)).map((note) => note.id);
    }
    latencies.push(performance.now() - started);
    const recall = recallAt(question.esperadas, ranked, 5);
    recalls.push(recall);
    ranks.push(reciprocalRank(question.esperadas, ranked));
    byCategory.set(question.categoria, [...(byCategory.get(question.categoria) ?? []), recall]);
    if (recall < 1) misses.push(question.id);
  }

  return {
    method,
    recall5: mean(recalls),
    mrr: mean(ranks),
    p50ms: percentile(latencies, 50),
    p95ms: percentile(latencies, 95),
    byCategory: Object.fromEntries([...byCategory].map(([category, values]) => [category, mean(values)])),
    misses,
  };
}
