import { Pool as NeonPool } from '@neondatabase/serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>;

export interface DbEnv {
  DATABASE_URL: string;
  DATABASE_DRIVER: 'neon' | 'pg';
}

export interface OpenDb {
  db: Db;
  close: () => Promise<void>;
}

// Neon on Cloudflare, plain TCP everywhere else (ADR 0010). A Worker cannot keep a
// connection between requests, so each request opens its own pool and closes it with
// ctx.waitUntil(close()).
export function openDb(env: DbEnv): OpenDb {
  const config = { schema, casing: 'snake_case' } as const;
  switch (env.DATABASE_DRIVER) {
    case 'neon': {
      const pool = new NeonPool({ connectionString: env.DATABASE_URL });
      return { db: drizzleNeon({ client: pool, ...config }), close: () => pool.end() };
    }
    case 'pg': {
      // A sleeping Neon branch can take a few seconds to wake; give it 15 s.
      const pool = new pg.Pool({
        connectionString: env.DATABASE_URL,
        connectionTimeoutMillis: 15_000,
      });
      return { db: drizzlePg({ client: pool, ...config }), close: () => pool.end() };
    }
    default:
      throw new Error(`Unknown DATABASE_DRIVER: ${String(env.DATABASE_DRIVER satisfies never)}`);
  }
}
