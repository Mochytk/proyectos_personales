import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BACKUP_SCHEMA_VERSION, SECRET_SETTINGS, buildBackup, parseBackup } from '../store/backup';
import type { AppSettings, MediaItem, MediaList } from '../store/useStore';

/**
 * Backups must stay importable forever. `tests/fixtures/backups/v<N>.json` are real exports from
 * each version of the format; they are frozen and never edited. See BACKUP_SCHEMA_VERSION in
 * store/backup.ts for what to do when the format changes.
 */
const FIXTURES_DIR = path.join(__dirname, 'fixtures', 'backups');
const fixtures = fs
  .readdirSync(FIXTURES_DIR)
  .filter((name) => /^v\d+\.json$/.test(name))
  .map((name) => ({ name, version: Number(name.slice(1, -5)), text: fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8') }));

describe('frozen backup fixtures', () => {
  it('has a fixture for every version up to the current one', () => {
    const versions = fixtures.map((f) => f.version).sort((a, b) => a - b);
    expect(versions).toEqual(Array.from({ length: BACKUP_SCHEMA_VERSION }, (_, i) => i + 1));
  });

  for (const fixture of fixtures) {
    describe(fixture.name, () => {
      const raw = JSON.parse(fixture.text);

      it('declares the version in its name', () => {
        expect(raw.schemaVersion).toBe(fixture.version);
      });

      it('still imports, keeping every item and list', () => {
        const imported = parseBackup(fixture.text);
        expect(imported.items.map((i) => i.id)).toEqual(raw.data.items.map((i: { id: string }) => i.id));
        expect(imported.lists.map((l) => l.id)).toEqual(raw.data.lists.map((l: { id: string }) => l.id));
      });

      it('survives export and import again unchanged', () => {
        const once = parseBackup(fixture.text);
        expect(parseBackup(buildBackup(once))).toEqual(once);
      });

      if (fixture.version === BACKUP_SCHEMA_VERSION) {
        it('loses no field when it is the current format', () => {
          const imported = parseBackup(fixture.text);
          expect(imported.items).toEqual(raw.data.items);
          expect(imported.lists).toEqual(raw.data.lists);
        });
      }
    });
  }
});

describe('field coverage', () => {
  // `Required<...>` makes these objects fail to compile when a field is added to the model, so a
  // new field cannot be forgotten in the backup code (it would otherwise be dropped on import).
  const item: Required<MediaItem> = {
    id: 'i', title: 't', subtitle: 's', type: 'tv_show', status: 'in_progress', progress: 0.5,
    totalCheckpoints: 30, currentCheckpoint: 13, checkpointType: 'episodes', seasons: [10, 8, 12],
    nextEpisode: { date: '2026-11-01', season: 3, episode: 2 },
    rating: 4, tags: ['a'], notes: 'n', dueDate: 1_760_000_000_000, dueHasTime: true, remind: true, notifiedAt: 1_760_000_100_000,
    createdAt: 1, updatedAt: 2, listId: 'l', externalId: 'tmdb:tv:1', posterUrl: 'https://x/p.jpg', overview: 'o', releaseDate: '2020-01-01',
  };
  const list: Required<MediaList> = {
    id: 'l', name: 'Lista', isPinned: true, type: 'collection', layoutStyle: 'large_grid', itemShape: 'tall', sortOrder: 'a_z',
    isSmartList: true, smartFilters: { types: ['movie'], minRating: 3 },
  };
  const settings: Required<AppSettings> = {
    showEnjoying: false, showPlanner: false, showLogbook: false, pileLayoutStyle: 'large_grid', pileItemShape: 'tall',
    tmdbApiKey: 'SECRET-A', rawgApiKey: 'SECRET-B',
  };

  it('round-trips every item and list field', () => {
    const imported = parseBackup(buildBackup({ items: [item], lists: [list], settings }));
    expect(imported.items).toEqual([item]);
    expect(imported.lists).toEqual([list]);
  });

  it('exports every setting except the secret ones', () => {
    const exported = JSON.parse(buildBackup({ items: [], lists: [], settings })).data.settings;
    const secret: readonly string[] = SECRET_SETTINGS;
    expect(Object.keys(exported).sort()).toEqual(Object.keys(settings).filter((k) => !secret.includes(k)).sort());
  });
});
