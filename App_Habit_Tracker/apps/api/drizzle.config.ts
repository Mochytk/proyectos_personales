import { defineConfig } from 'drizzle-kit';

// Generates SQL migrations into ./drizzle (ADR 0004). Migrating a real environment runs
// from the manual GitHub workflow; never `drizzle-kit push`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});
