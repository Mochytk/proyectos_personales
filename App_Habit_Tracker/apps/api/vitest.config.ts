import { defineConfig } from 'vitest/config';

// The API tests run in Node against the Hono app and a real Postgres (ADR 0010).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
