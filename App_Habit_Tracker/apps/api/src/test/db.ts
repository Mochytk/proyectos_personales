import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

// A Postgres server the tests may create and drop databases in. Never a real environment.
const ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';

export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

// A fresh, migrated database with a random name, so test files can run in parallel.
export async function createTestDatabase(): Promise<TestDatabase> {
  const name = `test_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: ADMIN_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.toString() });
  await migrate(drizzle({ client: pool }), {
    migrationsFolder: new URL('../../drizzle', import.meta.url).pathname,
  });
  await pool.end();

  return {
    url: url.toString(),
    async drop() {
      const client = new pg.Client({ connectionString: ADMIN_URL });
      await client.connect();
      await client.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await client.end();
    },
  };
}
