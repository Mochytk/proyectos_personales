import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT, DEFAULT_SETTINGS, buildBackup, dropOrphanListRefs, mergeData, normalizeData, parseBackup, sanitizeItem,
} from '../store/backup';
import type { MediaItem, MediaList } from '../store/useStore';

const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: '1', title: 'A', type: 'movie', status: 'unstarted', progress: 0, createdAt: 1, updatedAt: 5, ...over,
});
const list: MediaList = { id: 'L', name: 'Lista', isPinned: false, type: 'todo' };
const data = (items: MediaItem[] = [item()], lists: MediaList[] = [list]) => ({ items, lists, settings: DEFAULT_SETTINGS });

describe('backup file', () => {
  it('round-trips through build and parse', () => {
    const parsed = parseBackup(buildBackup(data(), 1), 1);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.lists[0].name).toBe('Lista');
  });

  it('never writes the TMDB key', () => {
    const text = buildBackup({ ...data(), settings: { ...DEFAULT_SETTINGS, tmdbApiKey: 'SECRET' } }, 1);
    expect(text).not.toContain('SECRET');
  });

  it('rejects invalid JSON, other formats and newer versions', () => {
    expect(() => parseBackup('nope', 1)).toThrow(/JSON/);
    expect(() => parseBackup('{"format":"x"}', 1)).toThrow(/respaldo de Media Tracker/);
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 9, data: {} }), 1)).toThrow(/más nueva/);
  });
});

describe('sanitizing', () => {
  it('drops broken records and fixes unknown values', () => {
    const clean = normalizeData({ items: [{ id: '2', title: 'B', type: 'bogus', updatedAt: 1 }, { bad: 1 }, null], lists: 'x' });
    expect(clean.items).toHaveLength(1);
    expect(clean.items[0].type).toBe('software');
    expect(clean.lists).toEqual([]);
  });

  it('keeps metadata and reminder fields', () => {
    const it = sanitizeItem({ id: '1', title: 't', externalId: 'tmdb:movie:1', posterUrl: 'u', overview: 5, remind: true, dueHasTime: true })!;
    expect(it.externalId).toBe('tmdb:movie:1');
    expect(it.overview).toBeUndefined();
    expect(it.remind).toBe(true);
    expect(it.dueHasTime).toBe(true);
  });

  it('clears references to lists that no longer exist', () => {
    expect(dropOrphanListRefs([item({ listId: 'GONE' })], [list])[0].listId).toBeUndefined();
    expect(dropOrphanListRefs([item({ listId: 'L' })], [list])[0].listId).toBe('L');
  });
});

describe('mergeData', () => {
  it('adds new items, lets the newest version win and never deletes', () => {
    const current = data([item({ id: '1', title: 'old', updatedAt: 5 }), item({ id: '3', title: 'keep' })]);
    const incoming = data([item({ id: '1', title: 'new', updatedAt: 9 }), item({ id: '2', title: 'added' })], []);
    const merged = mergeData(current, incoming);
    expect(merged.added).toBe(1);
    expect(merged.updated).toBe(1);
    expect(merged.items.map(i => i.title).sort()).toEqual(['added', 'keep', 'new']);
  });

  it('keeps the older incoming item out when the current one is newer', () => {
    const merged = mergeData(data([item({ title: 'mine', updatedAt: 9 })]), data([item({ title: 'theirs', updatedAt: 1 })]));
    expect(merged.items[0].title).toBe('mine');
    expect(merged.updated).toBe(0);
  });

  it('keeps current settings', () => {
    const merged = mergeData({ ...data(), settings: { ...DEFAULT_SETTINGS, showPlanner: false } }, data());
    expect(merged.settings.showPlanner).toBe(false);
  });
});
