import { describe, expect, it } from 'vitest';
import { SYNC_FORMAT, SYNC_SCHEMA_VERSION, SyncData, buildSyncFile, canonicalSyncJson, mergeSyncData, parseSyncFile, summarizeMerge } from '../store/sync';
import { emptyTombstones } from '../store/tombstones';
import type { MediaItem, MediaList } from '../store/useStore';

const item = (id: string, updatedAt: number, over: Partial<MediaItem> = {}): MediaItem => ({
  id, title: id, type: 'movie', status: 'unstarted', progress: 0, tags: [], createdAt: 1, updatedAt, ...over,
});
const list = (id: string, updatedAt?: number, over: Partial<MediaList> = {}): MediaList => ({ id, name: id, isPinned: false, type: 'collection', updatedAt, ...over });
const data = (items: MediaItem[] = [], lists: MediaList[] = [], deleted = emptyTombstones()): SyncData => ({ items, lists, deleted });

// Order must not matter, so compare the canonical form.
const canon = canonicalSyncJson;

describe('mergeSyncData', () => {
  it('brings in what the other device has and keeps what only this one has', () => {
    const merged = mergeSyncData(data([item('a', 1)]), [data([item('b', 1)])]);
    expect(merged.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('keeps the copy changed last, whichever side it is on', () => {
    expect(mergeSyncData(data([item('a', 5, { title: 'local' })]), [data([item('a', 9, { title: 'remote' })])]).items[0].title).toBe('remote');
    expect(mergeSyncData(data([item('a', 9, { title: 'local' })]), [data([item('a', 5, { title: 'remote' })])]).items[0].title).toBe('local');
  });

  it('breaks a tie the same way on every device', () => {
    const a = item('x', 5, { title: 'one' });
    const b = item('x', 5, { title: 'two' });
    expect(canon(mergeSyncData(data([a]), [data([b])]))).toBe(canon(mergeSyncData(data([b]), [data([a])])));
  });

  it('does not bring back something deleted on another device', () => {
    const merged = mergeSyncData(data([item('a', 5)]), [data([], [], { items: { a: 10 }, lists: {} })]);
    expect(merged.items).toEqual([]);
    expect(merged.deleted.items.a).toBe(10);
  });

  it('keeps an item that was changed after it was deleted elsewhere', () => {
    const merged = mergeSyncData(data([item('a', 20)]), [data([], [], { items: { a: 10 }, lists: {} })]);
    expect(merged.items.map((i) => i.id)).toEqual(['a']);
  });

  it('removes a list deleted elsewhere and unlists its items', () => {
    const merged = mergeSyncData(
      data([item('a', 5, { listId: 'L' })], [list('L', 1)]),
      [data([], [], { items: {}, lists: { L: 10 } })],
    );
    expect(merged.lists).toEqual([]);
    expect(merged.items[0].listId).toBeUndefined();
  });

  it('takes the newest copy of a list, treating a list without date as the oldest', () => {
    const merged = mergeSyncData(data([], [list('L', undefined, { name: 'old' })]), [data([], [list('L', 3, { name: 'new' })])]);
    expect(merged.lists[0].name).toBe('new');
  });

  it('merges with several devices at once', () => {
    const merged = mergeSyncData(data([item('a', 1)]), [data([item('b', 1)]), data([item('c', 1), item('a', 4, { title: 'edited' })])]);
    expect(merged.items.map((i) => i.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.items.find((i) => i.id === 'a')!.title).toBe('edited');
  });

  it('with nothing to merge, returns the same data', () => {
    const local = data([item('a', 1)], [list('L', 1)]);
    expect(canon(mergeSyncData(local, []))).toBe(canon(local));
  });
});

describe('convergence', () => {
  // A tiny deterministic generator, so these checks are repeatable.
  let seed = 12345;
  const rand = (n: number) => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed % n;
  };
  const randomDevice = (): SyncData => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const items = ids.filter(() => rand(3) > 0).map((id) => item(id, rand(20), { title: `t${rand(4)}`, listId: rand(2) ? 'L1' : undefined }));
    const lists = ['L1', 'L2'].filter(() => rand(2)).map((id) => list(id, rand(20), { name: `n${rand(3)}` }));
    const deleted = emptyTombstones();
    for (const id of ids) if (rand(5) === 0) deleted.items[id] = rand(25);
    for (const id of ['L1', 'L2']) if (rand(6) === 0) deleted.lists[id] = rand(25);
    return { items, lists, deleted };
  };

  it('gives the same result whatever the order of the devices (200 random cases)', () => {
    for (let i = 0; i < 200; i++) {
      const [a, b, c] = [randomDevice(), randomDevice(), randomDevice()];
      const expected = canon(mergeSyncData(a, [b, c]));
      expect(canon(mergeSyncData(b, [c, a]))).toBe(expected);
      expect(canon(mergeSyncData(c, [a, b]))).toBe(expected);
    }
  });

  it('is stable when applied again, and when merged step by step (200 random cases)', () => {
    for (let i = 0; i < 200; i++) {
      const [a, b, c] = [randomDevice(), randomDevice(), randomDevice()];
      const once = mergeSyncData(a, [b, c]);
      expect(canon(mergeSyncData(once, [b, c]))).toBe(canon(once));
      expect(canon(mergeSyncData(mergeSyncData(a, [b]), [c]))).toBe(canon(once));
    }
  });
});

describe('summarizeMerge', () => {
  it('counts what a merge added, updated and removed on this device', () => {
    const before = data([item('a', 1), item('b', 1), item('c', 1)]);
    const after = data([item('a', 1), item('b', 7), item('d', 1)]);
    expect(summarizeMerge(before, after)).toEqual({ added: 1, updated: 1, removed: 1 });
  });
});

describe('sync file', () => {
  it('round-trips through build and parse', () => {
    const original = data([item('a', 5, { saga: { name: 'S', number: 1 }, posterUrl: 'https://x/p.jpg' })], [list('L', 3)], { items: { z: 9 }, lists: {} });
    const parsed = parseSyncFile(buildSyncFile(original, 'mac-1', 1234));
    expect(parsed).toMatchObject({ deviceId: 'mac-1', savedAt: 1234 });
    expect(canon(parsed.data)).toBe(canon(original));
  });

  it('declares its format and version', () => {
    expect(JSON.parse(buildSyncFile(data(), 'd'))).toMatchObject({ format: SYNC_FORMAT, schemaVersion: SYNC_SCHEMA_VERSION });
  });

  it('rejects things that are not sync files, and files from a newer version', () => {
    expect(() => parseSyncFile('nope')).toThrow(/JSON/);
    expect(() => parseSyncFile('{"format":"x"}')).toThrow(/no es de la sincronización/);
    expect(() => parseSyncFile(JSON.stringify({ format: SYNC_FORMAT, deviceId: 'd', data: {} , schemaVersion: SYNC_SCHEMA_VERSION + 1 }))).toThrow(/más nueva/);
    expect(() => parseSyncFile(JSON.stringify({ format: SYNC_FORMAT, schemaVersion: 1, data: {} }))).toThrow(/dispositivo/);
  });

  it('drops broken records instead of failing', () => {
    const text = JSON.stringify({ format: SYNC_FORMAT, schemaVersion: 1, deviceId: 'd', data: { items: [{ id: 'ok', title: 'T' }, { bad: 1 }], lists: 'x', deleted: { items: { a: 'no', b: 3 } } } });
    const parsed = parseSyncFile(text);
    expect(parsed.data.items.map((i) => i.id)).toEqual(['ok']);
    expect(parsed.data.lists).toEqual([]);
    expect(parsed.data.deleted.items).toEqual({ b: 3 });
  });
});
