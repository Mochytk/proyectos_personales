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
  it('creates the Better Auth tables', async () => {
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`,
    );
    expect(tables.rows.map((row) => row.table_name)).toEqual(
      expect.arrayContaining(['account', 'rate_limit', 'session', 'user', 'verification']),
    );
  });
});
