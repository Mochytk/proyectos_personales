import { afterEach, describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT, BACKUP_MIGRATIONS, BACKUP_SCHEMA_VERSION, DEFAULT_SETTINGS, buildBackup, dropOrphanListRefs, mergeData, migrateBackupData,
  normalizeData, parseBackup, sanitizeItem,
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

  it('never writes API keys', () => {
    const text = buildBackup({ ...data(), settings: { ...DEFAULT_SETTINGS, tmdbApiKey: 'SECRET1', rawgApiKey: 'SECRET2' } }, 1);
    expect(text).not.toContain('SECRET');
    expect(text).toContain('showPlanner');
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

  it('keeps valid seasons and drops invalid ones', () => {
    expect(sanitizeItem({ id: '1', title: 't', seasons: [10, 0, 8] })!.seasons).toEqual([10, 8]);
    expect(sanitizeItem({ id: '1', title: 't', seasons: 'x' })!.seasons).toBeUndefined();
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

describe('backup versions', () => {
  afterEach(() => {
    for (const key of Object.keys(BACKUP_MIGRATIONS)) delete BACKUP_MIGRATIONS[Number(key)];
  });

  it('writes the current schema version by default', () => {
    expect(JSON.parse(buildBackup(data())).schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it('treats files with a missing or invalid version as the first format', () => {
    const file = (schemaVersion: unknown) => JSON.stringify({ format: BACKUP_FORMAT, schemaVersion, data: { items: [{ id: '1', title: 'A' }] } });
    for (const version of [undefined, 0, -3, 1.5, 'x', null]) {
      expect(parseBackup(file(version)).items).toHaveLength(1);
    }
  });

  it('refuses a file from a newer version instead of silently dropping what it cannot read', () => {
    const file = JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION + 1, data: {} });
    expect(() => parseBackup(file)).toThrow(/más nueva/);
  });

  it('upgrades an old file one version at a time, in order', () => {
    const calls: number[] = [];
    BACKUP_MIGRATIONS[1] = (d) => { calls.push(1); return { ...d, step: [...((d.step as string[]) ?? []), 'v1->v2'] }; };
    BACKUP_MIGRATIONS[2] = (d) => { calls.push(2); return { ...d, step: [...((d.step as string[]) ?? []), 'v2->v3'] }; };
    expect(migrateBackupData({}, 1, 3)).toEqual({ step: ['v1->v2', 'v2->v3'] });
    expect(calls).toEqual([1, 2]);
    expect(migrateBackupData({ keep: 1 }, 2, 3)).toEqual({ keep: 1, step: ['v2->v3'] });
  });

  it('runs the migrations when a file is parsed', () => {
    BACKUP_MIGRATIONS[1] = (d) => ({ ...d, items: (d.items as { name: string }[]).map((i) => ({ id: i.name, title: i.name })) });
    const file = JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 1, data: { items: [{ name: 'Dune' }] } });
    expect(parseBackup(file, 2).items.map((i) => i.title)).toEqual(['Dune']);
  });

  it('fails loudly when a migration step is missing', () => {
    expect(() => migrateBackupData({}, 1, 3)).toThrow(/falta el paso de 1 a 2/);
  });
});
