import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../test/db';

let database: TestDatabase;
let client: pg.Client;

beforeAll(async () => {
  database = await createTestDatabase();
  client = new pg.Client({ connectionString: database.url });
  await client.connect();
});

afterAll(async () => {
  await client.end();
  await database.drop();
});

describe('database schema', () => {
  it('creates the auth and synced tables and the sync sequence', async () => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining([
        'account',
        'anchors',
        'check_ins',
        'habits',
        'rate_limit',
        'session',
        'user',
        'user_settings',
        'verification',
        'weekly_quota_overrides',
        'weekly_reviews',
      ]),
    );
    const sequences = await client.query(
      `SELECT 1 FROM pg_sequences WHERE sequencename = 'sync_seq'`,
    );
    expect(sequences.rowCount).toBe(1);
  });

  it('keys synced rows by user and id', async () => {
    const key = await client.query<{ column_name: string }>(
      `SELECT a.attname AS column_name
         FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = 'check_ins'::regclass AND i.indisprimary ORDER BY a.attname`,
    );
    expect(key.rows.map((row) => row.column_name)).toEqual(['id', 'user_id']);

    const insert = `INSERT INTO anchors (user_id, id, created_at, updated_at, name, sort_order, server_seq)
                    VALUES ($1, '6b0b2a1e-3c4d-5e6f-8a9b-0c1d2e3f4a5b', now(), now(), 'Mañana', 0, nextval('sync_seq'))`;
    await client.query(insert, ['user-a']);
    await client.query(insert, ['user-b']);
    const rows = await client.query(`SELECT user_id FROM anchors ORDER BY user_id`);
    expect(rows.rows).toEqual([{ user_id: 'user-a' }, { user_id: 'user-b' }]);
  });

  it('indexes synced rows by user and server sequence for pull', async () => {
    const indexes = await client.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'habits'`,
    );
    expect(indexes.rows.some((row) => row.indexdef.includes('(user_id, server_seq)'))).toBe(true);
  });
});
