import { describe, expect, it } from 'vitest';
import { addTombstone, emptyTombstones, pruneTombstones, sanitizeTombstones } from '../store/tombstones';

describe('addTombstone', () => {
  it('records the time of a deletion without touching the original', () => {
    const before = emptyTombstones();
    const after = addTombstone(before, 'items', 'a', 100);
    expect(after).toEqual({ items: { a: 100 }, lists: {} });
    expect(before).toEqual({ items: {}, lists: {} });
  });

  it('keeps the earlier time if the id was already recorded', () => {
    const once = addTombstone(emptyTombstones(), 'lists', 'l', 100);
    expect(addTombstone(once, 'lists', 'l', 999)).toBe(once);
  });
});

describe('sanitizeTombstones', () => {
  it('keeps id -> time pairs and drops everything else', () => {
    expect(sanitizeTombstones({ items: { a: 1, b: 'x', '': 5, c: NaN }, lists: ['no'], extra: 1 })).toEqual({ items: { a: 1 }, lists: {} });
  });

  it('copes with missing or broken input', () => {
    expect(sanitizeTombstones(undefined)).toEqual(emptyTombstones());
    expect(sanitizeTombstones('x')).toEqual(emptyTombstones());
    expect(sanitizeTombstones(null)).toEqual(emptyTombstones());
  });
});

describe('pruneTombstones', () => {
  it('forgets old deletions and keeps recent ones', () => {
    const day = 86_400_000;
    const pruned = pruneTombstones({ items: { old: 0, fresh: 100 * day }, lists: { oldList: 1, freshList: 99 * day } }, 100 * day, 30 * day);
    expect(pruned).toEqual({ items: { fresh: 100 * day }, lists: { freshList: 99 * day } });
  });
});
