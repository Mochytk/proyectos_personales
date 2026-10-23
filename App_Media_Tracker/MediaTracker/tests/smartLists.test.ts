import { describe, expect, it } from 'vitest';
import { describeFilters, matchesSmartFilters, matchingItems, sanitizeSmartFilters } from '../store/smartLists';
import type { MediaItem } from '../store/useStore';

const DAY = 86_400_000;
const now = 1_800_000_000_000;
const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'i', title: 't', type: 'movie', status: 'unstarted', progress: 0, tags: [], createdAt: 1, updatedAt: now, ...over,
});

describe('matchesSmartFilters', () => {
  it('with no filters, matches everything except finished items (as smart lists always did)', () => {
    expect(matchesSmartFilters(item(), undefined, now)).toBe(true);
    expect(matchesSmartFilters(item(), {}, now)).toBe(true);
    expect(matchesSmartFilters(item({ status: 'in_progress' }), {}, now)).toBe(true);
    expect(matchesSmartFilters(item({ status: 'abandoned' }), {}, now)).toBe(true);
    expect(matchesSmartFilters(item({ status: 'completed' }), {}, now)).toBe(false);
  });

  it('filters by type, and an empty list of types means any', () => {
    expect(matchesSmartFilters(item({ type: 'book' }), { types: ['movie', 'tv_show'] }, now)).toBe(false);
    expect(matchesSmartFilters(item({ type: 'tv_show' }), { types: ['movie', 'tv_show'] }, now)).toBe(true);
    expect(matchesSmartFilters(item({ type: 'book' }), { types: [] }, now)).toBe(true);
  });

  it('filters by status, and lets finished items in when asked', () => {
    const f = { statuses: ['completed' as const] };
    expect(matchesSmartFilters(item({ status: 'completed' }), f, now)).toBe(true);
    expect(matchesSmartFilters(item({ status: 'in_progress' }), f, now)).toBe(false);
    expect(matchesSmartFilters(item({ status: 'abandoned' }), { statuses: ['in_progress', 'abandoned'] }, now)).toBe(true);
  });

  it('filters by minimum rating, treating no rating as 0', () => {
    expect(matchesSmartFilters(item({ rating: 4 }), { minRating: 4 }, now)).toBe(true);
    expect(matchesSmartFilters(item({ rating: 3 }), { minRating: 4 }, now)).toBe(false);
    expect(matchesSmartFilters(item({ rating: 0 }), { minRating: 1 }, now)).toBe(false);
    expect(matchesSmartFilters(item(), { minRating: 1 }, now)).toBe(false);
  });

  it('matches any of the tags, ignoring case', () => {
    const f = { tags: ['Clásico', 'sci-fi'] };
    expect(matchesSmartFilters(item({ tags: ['clásico'] }), f, now)).toBe(true);
    expect(matchesSmartFilters(item({ tags: ['otro', 'SCI-FI'] }), f, now)).toBe(true);
    expect(matchesSmartFilters(item({ tags: ['otro'] }), f, now)).toBe(false);
    expect(matchesSmartFilters(item({ tags: undefined }), f, now)).toBe(false);
  });

  it('keeps only items not changed for the given days', () => {
    expect(matchesSmartFilters(item({ updatedAt: now - 29 * DAY }), { staleDays: 30 }, now)).toBe(false);
    expect(matchesSmartFilters(item({ updatedAt: now - 30 * DAY }), { staleDays: 30 }, now)).toBe(true);
    expect(matchesSmartFilters(item({ updatedAt: now - 400 * DAY }), { staleDays: 30 }, now)).toBe(true);
  });

  it('requires every filter to match', () => {
    const f = { types: ['tv_show' as const], statuses: ['in_progress' as const], minRating: 4, staleDays: 30 };
    const ok = item({ type: 'tv_show', status: 'in_progress', rating: 5, updatedAt: now - 40 * DAY });
    expect(matchesSmartFilters(ok, f, now)).toBe(true);
    for (const broken of [{ type: 'movie' as const }, { status: 'unstarted' as const }, { rating: 2 }, { updatedAt: now }]) {
      expect(matchesSmartFilters({ ...ok, ...broken }, f, now)).toBe(false);
    }
  });
});

describe('matchingItems', () => {
  it('returns the matching items in order', () => {
    const items = [item({ id: 'a', type: 'book' }), item({ id: 'b' }), item({ id: 'c', status: 'completed' }), item({ id: 'd' })];
    expect(matchingItems(items, { types: ['movie'] }, now).map((i) => i.id)).toEqual(['b', 'd']);
  });
});

describe('sanitizeSmartFilters', () => {
  it('keeps valid filters', () => {
    const f = { types: ['movie'], statuses: ['in_progress'], minRating: 4, tags: ['a'], staleDays: 30 };
    expect(sanitizeSmartFilters(f)).toEqual(f);
  });

  it('drops invalid values and duplicates', () => {
    expect(sanitizeSmartFilters({
      types: ['movie', 'movie', 'nope', 3], statuses: ['completed', 'x'], minRating: 9, tags: [' a ', 'a', '', 5], staleDays: 0.5, extra: 1,
    })).toEqual({ types: ['movie'], statuses: ['completed'], tags: ['a'] });
    expect(sanitizeSmartFilters({ minRating: 3.6, staleDays: 90 })).toEqual({ minRating: 4, staleDays: 90 });
    expect(sanitizeSmartFilters({ minRating: 0 })).toEqual({});
  });

  it('is undefined for anything that is not an object', () => {
    for (const bad of [undefined, null, 'x', 5, ['movie']]) expect(sanitizeSmartFilters(bad)).toBeUndefined();
  });
});

describe('describeFilters', () => {
  it('says what a list holds', () => {
    expect(describeFilters(undefined)).toEqual(['Todo lo pendiente']);
    expect(describeFilters({})).toEqual(['Todo lo pendiente']);
    expect(describeFilters({ types: ['movie', 'tv_show'], statuses: ['in_progress'], minRating: 4, tags: ['clásico'], staleDays: 30 })).toEqual([
      'Películas, Series', 'En curso', '★★★★ o más', '#clásico', 'Sin tocar hace 30 días o más',
    ]);
  });
});
