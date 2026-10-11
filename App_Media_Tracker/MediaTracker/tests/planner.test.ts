import { describe, expect, it } from 'vitest';
import { buildPlannerEntries, groupEntries } from '../store/planner';
import type { MediaItem } from '../store/useStore';

const now = new Date(2026, 9, 10, 12, 0).getTime();
const day = (n: number, h = 0) => new Date(2026, 9, 10 + n, h, 0).getTime();
const iso = (n: number) => `2026-10-${String(10 + n).padStart(2, '0')}`;
const item = (over: Partial<MediaItem>): MediaItem => ({
  id: Math.random().toString(36).slice(2), title: 'x', type: 'movie', status: 'unstarted', progress: 0, createdAt: 1, updatedAt: 1, ...over,
});

describe('buildPlannerEntries', () => {
  it('lists dated items, tasks and events, and leaves out the rest', () => {
    const entries = buildPlannerEntries([
      item({ title: 'dated movie', dueDate: day(2) }),
      item({ title: 'task', type: 'task' }),
      item({ title: 'event', type: 'event', dueDate: day(1) }),
      item({ title: 'plain movie' }),
      item({ title: 'done', dueDate: day(1), status: 'completed' }),
    ], now);
    expect(entries.map((e) => e.item.title)).toEqual(['event', 'dated movie', 'task']);
  });

  it('adds a series whose next episode has not aired, as a premiere', () => {
    const [entry] = buildPlannerEntries([item({ type: 'tv_show', nextEpisode: { date: iso(3), season: 2, episode: 1 } })], now);
    expect(entry.premiere).toEqual({ date: iso(3), season: 2, episode: 1 });
    expect(entry.date).toBe(day(3));
  });

  it('ignores a next episode that already aired and one on a non-series', () => {
    expect(buildPlannerEntries([item({ type: 'tv_show', nextEpisode: { date: iso(-2), season: 1, episode: 2 } })], now)).toEqual([]);
    expect(buildPlannerEntries([item({ type: 'movie', nextEpisode: { date: iso(3), season: 1, episode: 1 } })], now)).toEqual([]);
  });

  it('lets a due date set by the user win over the air date', () => {
    const [entry] = buildPlannerEntries([item({ type: 'tv_show', dueDate: day(5), nextEpisode: { date: iso(3), season: 1, episode: 1 } })], now);
    expect(entry.date).toBe(day(5));
    expect(entry.premiere).toBeUndefined();
  });
});

describe('groupEntries', () => {
  it('orders groups from overdue to undated and drops empty ones', () => {
    const entries = buildPlannerEntries([
      item({ title: 'later', dueDate: day(30) }),
      item({ title: 'undated', type: 'task' }),
      item({ title: 'overdue', dueDate: day(-3) }),
      item({ title: 'premiere', type: 'tv_show', nextEpisode: { date: iso(1), season: 1, episode: 1 } }),
    ], now);
    const groups = groupEntries(entries, now);
    expect(groups.map((g) => g.key)).toEqual(['overdue', 'tomorrow', 'later', 'undated']);
    expect(groups[1].entries[0].item.title).toBe('premiere');
  });
});
