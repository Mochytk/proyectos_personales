import { defineConfig, devices } from '@playwright/test';

const ci = Boolean(process.env.CI);
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

// The sync tests run against the real Worker (`wrangler dev`) and a fresh database on the
// test Postgres, so they live apart from the other E2E, which need no server.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'sync.spec.ts',
  // One at a time: they share the server, and each waits on real sync timers.
  workers: 1,
  forbidOnly: ci,
  reporter: 'list',
  timeout: 90_000,
  use: {
    baseURL: 'http://localhost:8788',
    timezoneId: 'America/Santiago',
    locale: 'es-CL',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm build && pnpm --filter @habit-tracker/api run e2e:server',
    url: 'http://localhost:8788/api/health',
    reuseExistingServer: !ci,
    timeout: 180_000,
  },
});
