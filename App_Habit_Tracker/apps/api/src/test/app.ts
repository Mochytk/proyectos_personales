import type { Hono } from 'hono';
import type { AppEnv } from '../app';

// Where `wrangler dev` serves the Worker.
const LOCAL = 'http://localhost:8787';

// Bindings for app.request() against a test database. The secret is a test-only value.
export function testEnv(databaseUrl: string, overrides: Partial<Env> = {}): Env {
  return {
    ASSETS: { fetch: () => Promise.resolve(new Response(null, { status: 404 })) } as never,
    DATABASE_DRIVER: 'pg' as never,
    DATABASE_URL: databaseUrl,
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    AUTH_ALLOWED_HOSTS: 'localhost:*',
    AUTH_SIGNUP_ENABLED: 'true',
    ...overrides,
  };
}

// Runs ctx.waitUntil() work before the call returns, so each test sees a closed pool.
export async function request(
  app: Hono<AppEnv>,
  env: Env,
  path: string,
  init: RequestInit & { ip?: string; cookie?: string; json?: unknown } = {},
): Promise<Response> {
  const { ip = '203.0.113.1', cookie, json, ...rest } = init;
  const url = path.startsWith('http') ? path : `${LOCAL}${path}`;
  // Cloudflare always sends these; app.request() does not add them on its own.
  const headers = new Headers(rest.headers);
  headers.set('host', new URL(url).host);
  headers.set('cf-connecting-ip', ip);
  if (cookie) headers.set('cookie', cookie);
  if (json !== undefined) {
    headers.set('content-type', 'application/json');
    headers.set('origin', new URL(url).origin);
  }
  const pending: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => pending.push(promise),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  const response = await app.request(
    url,
    { ...rest, headers, body: json === undefined ? rest.body : JSON.stringify(json) },
    env,
    ctx,
  );
  await Promise.all(pending);
  return response;
}

// The `name=value` pair of the session cookie, for the next request's Cookie header.
export function sessionCookie(response: Response): string {
  const cookie = response.headers
    .getSetCookie()
    .find((header) => header.includes('session_token='));
  if (!cookie) throw new Error('No session cookie in the response');
  return cookie.split(';')[0] ?? '';
}
