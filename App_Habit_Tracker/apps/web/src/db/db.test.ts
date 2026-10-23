import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb, StorageUnavailableError, type HabitDb } from './db';

const opened: HabitDb[] = [];

async function openTestDb(): Promise<HabitDb> {
  const db = await openDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

describe('openDb', () => {
  it('opens the database with every table', async () => {
    const db = await openTestDb();
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'anchors',
      'checkIns',
      'habits',
      'outbox',
      'syncState',
      'userSettings',
      'weeklyQuotaOverrides',
      'weeklyReviews',
    ]);
  });

  it('indexes check-ins by habit and date together', async () => {
    const db = await openTestDb();
    const indexes = db.checkIns.schema.indexes.map((index) => index.name);
    expect(indexes).toContain('[habitId+localDate]');
    expect(db.outbox.schema.primKey.name).toBe('[table+id]');
  });

  it('rejects with StorageUnavailableError when IndexedDB is missing', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(openDb(`test-${crypto.randomUUID()}`)).rejects.toBeInstanceOf(
      StorageUnavailableError,
    );
  });
});
