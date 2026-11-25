// Starts the Worker for the end-to-end sync tests: a fresh, migrated database on the test
// Postgres (TEST_DATABASE_URL, never a real environment), a throwaway secret, and
// `wrangler dev` on port 8788. Run with `pnpm run e2e:server`; Playwright does it for you.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const ADMIN_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';
const NAME = 'constancia_e2e';
const PORT = '8788';

const admin = new pg.Client({ connectionString: ADMIN_URL });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${NAME} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${NAME}`);
await admin.end();

const url = new URL(ADMIN_URL);
url.pathname = `/${NAME}`;
const pool = new pg.Pool({ connectionString: url.toString() });
await migrate(drizzle({ client: pool }), {
  migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
});
await pool.end();

// .wrangler is ignored by git; the secret only lives for this run.
const varsDir = new URL('../.wrangler/', import.meta.url);
mkdirSync(varsDir, { recursive: true });
const varsFile = new URL('e2e.vars', varsDir).pathname;
writeFileSync(
  varsFile,
  [
    'DATABASE_DRIVER=pg',
    `DATABASE_URL=${url.toString()}`,
    `BETTER_AUTH_SECRET=${randomBytes(32).toString('base64')}`,
    'AUTH_ALLOWED_HOSTS=localhost:*',
    'AUTH_SIGNUP_ENABLED=true',
    'BREVO_API_KEY=',
    'EMAIL_FROM=',
    '',
  ].join('\n'),
);

const wrangler = spawn(
  'pnpm',
  ['exec', 'wrangler', 'dev', '--port', PORT, '--env-file', varsFile],
  {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: 'inherit',
  },
);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => wrangler.kill(signal));
}
wrangler.on('exit', (code) => process.exit(code ?? 0));
