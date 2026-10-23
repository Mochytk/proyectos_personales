import { describe, expect, it } from 'vitest';
import { computeStats, finishedAt } from '../store/stats';
import type { MediaItem } from '../store/useStore';

let n = 0;
const at = (y: number, m: number, d = 15) => new Date(y, m, d, 12, 0).getTime(); // m: 0-11
const done = (over: Partial<MediaItem>): MediaItem => ({
  id: `i${++n}`, title: `T${n}`, type: 'movie', status: 'completed', progress: 0, createdAt: 1, updatedAt: 1, completedAt: at(2026, 5), ...over,
});

describe('computeStats', () => {
  it('counts only finished items, by year', () => {
    const items = [
      done({ completedAt: at(2026, 0) }), done({ completedAt: at(2026, 5) }), done({ completedAt: at(2025, 11) }),
      done({ status: 'in_progress', completedAt: undefined }),
    ];
    expect(computeStats(items, 2026).total).toBe(2);
    expect(computeStats(items, 2025).total).toBe(1);
    expect(computeStats(items, 'all').total).toBe(3);
    expect(computeStats(items, 2026).years).toEqual([2026, 2025]);
  });

  it('falls back to the last change for items finished before completedAt existed', () => {
    const old = done({ completedAt: undefined, updatedAt: at(2024, 3) });
    expect(finishedAt(old)).toBe(at(2024, 3));
    expect(computeStats([old], 2024).total).toBe(1);
  });

  it('splits a year by month and finds the busiest one', () => {
    const items = [done({ completedAt: at(2026, 1) }), done({ completedAt: at(2026, 7) }), done({ completedAt: at(2026, 7, 2) }), done({ completedAt: at(2026, 7, 28) })];
    const stats = computeStats(items, 2026);
    expect(stats.byMonth).toHaveLength(12);
    expect(stats.byMonth[1]).toBe(1);
    expect(stats.byMonth[7]).toBe(3);
    expect(stats.busiestMonth).toBe(7);
    expect(stats.byYear).toEqual([]);
  });

  it('uses one bar per year when looking at everything', () => {
    const items = [done({ completedAt: at(2024, 1) }), done({ completedAt: at(2026, 1) }), done({ completedAt: at(2026, 2) })];
    const stats = computeStats(items, 'all');
    expect(stats.byYear).toEqual([{ year: 2024, count: 1 }, { year: 2026, count: 2 }]);
    expect(stats.byMonth).toEqual([]);
    expect(stats.busiestMonth).toBeUndefined();
  });

  it('has no busiest month for an empty year', () => {
    const stats = computeStats([], 2026);
    expect(stats.total).toBe(0);
    expect(stats.busiestMonth).toBeUndefined();
    expect(stats.ratings.average).toBeUndefined();
  });

  it('ranks types by count, then name', () => {
    const items = [done({ type: 'book' }), done({ type: 'movie' }), done({ type: 'movie' }), done({ type: 'tv_show' })];
    expect(computeStats(items, 2026).byType).toEqual([
      { type: 'movie', count: 2 }, { type: 'book', count: 1 }, { type: 'tv_show', count: 1 },
    ]);
  });

  it('summarises ratings and ignores 0 as "no rating"', () => {
    const items = [done({ rating: 5 }), done({ rating: 4 }), done({ rating: 4 }), done({ rating: 0 }), done({})];
    const { ratings } = computeStats(items, 2026);
    expect(ratings.counts).toEqual([0, 0, 0, 2, 1]);
    expect(ratings.unrated).toBe(2);
    expect(ratings.average).toBeCloseTo(13 / 3);
  });

  it('adds up pages of books and episodes of series, only when tracked that way', () => {
    const items = [
      done({ type: 'book', checkpointType: 'pages', totalCheckpoints: 300 }),
      done({ type: 'book', checkpointType: 'pages', currentCheckpoint: 200 }),
      done({ type: 'book', checkpointType: 'chapters', totalCheckpoints: 40 }),
      done({ type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 62 }),
      done({ type: 'movie', checkpointType: 'pages', totalCheckpoints: 999 }),
    ];
    const stats = computeStats(items, 2026);
    expect(stats.pages).toBe(500);
    expect(stats.episodes).toBe(62);
  });

  it('picks the three best rated, most recent first on ties', () => {
    const items = [
      done({ title: 'A', rating: 4, completedAt: at(2026, 1) }), done({ title: 'B', rating: 5, completedAt: at(2026, 2) }),
      done({ title: 'C', rating: 5, completedAt: at(2026, 4) }), done({ title: 'D', rating: 3 }), done({ title: 'E' }),
    ];
    expect(computeStats(items, 2026).topRated.map((i) => i.title)).toEqual(['C', 'B', 'A']);
  });

  it('lists sagas finished in the period (2+ books, all finished)', () => {
    const book = (title: string, saga: string, number: number, completedAt?: number, status: MediaItem['status'] = 'completed') =>
      done({ title, type: 'book', saga: { name: saga, number }, status, completedAt });
    const items = [
      book('1', 'Mistborn', 1, at(2026, 1)), book('2', 'Mistborn', 2, at(2026, 4)),
      book('1', 'Dune', 1, at(2025, 1)), book('2', 'Dune', 2, at(2025, 3)),
      book('1', 'Incompleta', 1, at(2026, 1)), book('2', 'Incompleta', 2, undefined, 'in_progress'),
      book('1', 'Sola', 1, at(2026, 1)),
    ];
    expect(computeStats(items, 2026).finishedSagas).toEqual(['Mistborn']);
    expect(computeStats(items, 2025).finishedSagas).toEqual(['Dune']);
    expect(computeStats(items, 'all').finishedSagas.sort()).toEqual(['Dune', 'Mistborn']);
  });
});
