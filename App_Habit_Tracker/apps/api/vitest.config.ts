import { defineConfig } from 'vitest/config';

// The API tests run in Node against the Hono app and a real Postgres (ADR 0010).
export default defineConfig({
  // `cloudflare:workers` only exists inside workerd; Node gets a stand-in.
  resolve: {
    alias: {
      'cloudflare:workers': new URL('./src/test/cloudflare-workers.ts', import.meta.url).pathname,
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
