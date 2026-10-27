import { afterEach } from 'vitest';
import { openDb, type HabitDb } from '../db/db';

const opened: HabitDb[] = [];

afterEach(async () => {
  await Promise.all(opened.splice(0).map((db) => db.delete()));
});

// A fresh database per test, deleted afterwards.
export async function openTestDb(): Promise<HabitDb> {
  const db = await openDb(`test-${crypto.randomUUID()}`);
  opened.push(db);
  return db;
}
