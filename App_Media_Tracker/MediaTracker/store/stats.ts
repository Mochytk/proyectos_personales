import { sagasOf } from './sagas';
import type { MediaItem, MediaType } from './useStore';

export const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export type StatsPeriod = number | 'all';

export interface Stats {
  /** Years that have at least one finished item, newest first. */
  years: number[];
  total: number;
  byType: { type: MediaType; count: number }[];
  /** Finished per month (Jan-Dec) for a single year; empty when the period is "all". */
  byMonth: number[];
  /** Finished per year (oldest first) when the period is "all"; empty for a single year. */
  byYear: { year: number; count: number }[];
  /** Index (0-11) of the month with most items; undefined if there are none or the period is "all". */
  busiestMonth?: number;
  /** Finished items by stars 1-5 (index 0 = 1 star), and how many have no rating. */
  ratings: { counts: number[]; unrated: number; average?: number };
  /** Pages of the finished books that are tracked by pages. */
  pages: number;
  /** Episodes of the finished series that are tracked by episodes. */
  episodes: number;
  /** Best rated finished items, best first (ties: most recent first). */
  topRated: MediaItem[];
  /** Sagas whose books are all finished (2 or more), with the last one finished in this period. */
  finishedSagas: string[];
}

/** When an item was finished: `completedAt`, or its last change for data from before that existed. */
export const finishedAt = (item: MediaItem): number => item.completedAt ?? item.updatedAt;

export function computeStats(items: MediaItem[], period: StatsPeriod): Stats {
  const finished = items.filter((i) => i.status === 'completed');
  const years = [...new Set(finished.map((i) => new Date(finishedAt(i)).getFullYear()))].sort((a, b) => b - a);
  const inPeriod = period === 'all' ? finished : finished.filter((i) => new Date(finishedAt(i)).getFullYear() === period);

  const typeCounts = new Map<MediaType, number>();
  for (const item of inPeriod) typeCounts.set(item.type, (typeCounts.get(item.type) ?? 0) + 1);
  const byType = [...typeCounts].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

  const byMonth = period === 'all' ? [] : Array.from({ length: 12 }, () => 0);
  if (period !== 'all') for (const item of inPeriod) byMonth[new Date(finishedAt(item)).getMonth()]++;
  const peak = byMonth.length ? Math.max(...byMonth) : 0;

  const yearCounts = new Map<number, number>();
  if (period === 'all') for (const item of inPeriod) {
    const y = new Date(finishedAt(item)).getFullYear();
    yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
  }
  const byYear = [...yearCounts].map(([year, count]) => ({ year, count })).sort((a, b) => a.year - b.year);

  const counts = [0, 0, 0, 0, 0];
  let unrated = 0;
  let ratingSum = 0;
  let rated = 0;
  for (const item of inPeriod) {
    const stars = Math.round(item.rating ?? 0);
    if (stars >= 1 && stars <= 5) {
      counts[stars - 1]++;
      ratingSum += stars;
      rated++;
    } else unrated++;
  }

  const total = (item: MediaItem) => item.totalCheckpoints ?? item.currentCheckpoint ?? 0;
  const pages = inPeriod.filter((i) => i.type === 'book' && i.checkpointType === 'pages').reduce((sum, i) => sum + total(i), 0);
  const episodes = inPeriod.filter((i) => i.type === 'tv_show' && i.checkpointType === 'episodes').reduce((sum, i) => sum + total(i), 0);

  const topRated = inPeriod
    .filter((i) => (i.rating ?? 0) >= 1)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || finishedAt(b) - finishedAt(a))
    .slice(0, 3);

  const finishedSagas = sagasOf(items)
    .filter((saga) => saga.books.length >= 2 && saga.completed === saga.books.length)
    .filter((saga) => {
      if (period === 'all') return true;
      const last = Math.max(...saga.books.map(finishedAt));
      return new Date(last).getFullYear() === period;
    })
    .map((saga) => saga.name);

  return {
    years,
    total: inPeriod.length,
    byType,
    byMonth,
    byYear,
    busiestMonth: peak > 0 ? byMonth.indexOf(peak) : undefined,
    ratings: { counts, unrated, average: rated > 0 ? ratingSum / rated : undefined },
    pages,
    episodes,
    topRated,
    finishedSagas,
  };
}
