import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/db';
import { openDb } from './client';
import { anchors } from './schema';

let database: TestDatabase;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

describe('openDb', () => {
  it('runs queries over the pg driver', async () => {
    const { db, close } = openDb({ DATABASE_URL: database.url, DATABASE_DRIVER: 'pg' });
    try {
      expect(await db.execute(sql`select 1 as one`)).toMatchObject({ rows: [{ one: 1 }] });
    } finally {
      await close();
    }
  });

  it('leaves no rows behind when a transaction throws', async () => {
    const { db, close } = openDb({ DATABASE_URL: database.url, DATABASE_DRIVER: 'pg' });
    try {
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(anchors).values({
            userId: 'user-a',
            id: '6b0b2a1e-3c4d-5e6f-8a9b-0c1d2e3f4a5b',
            createdAt: new Date(),
            updatedAt: new Date(),
            serverSeq: 1,
            name: 'Mañana',
            sortOrder: 0,
          });
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
      expect(await db.select().from(anchors)).toEqual([]);
    } finally {
      await close();
    }
  });

  it('rejects an unknown driver', () => {
    expect(() => openDb({ DATABASE_URL: database.url, DATABASE_DRIVER: 'sqlite' as 'pg' })).toThrow(
      'Unknown DATABASE_DRIVER',
    );
  });
});
