import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app';
import { createAuth } from './auth';

// Opens the database and Better Auth for this request only, and closes the pool once the
// response is on its way. Only routes that need the database use it. Opening the pool does
// not connect: that happens on the first query.
export const withAuth = createMiddleware<AppEnv>(async (c, next) => {
  const { db, close } = c.var.services.connect();
  c.set('db', db);
  c.set(
    'auth',
    createAuth(c.env, db, c.req.url, {
      email: c.var.services.email(),
      waitUntil: (promise) => {
        c.executionCtx.waitUntil(promise);
      },
    }),
  );
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(close());
  }
});

// Need withAuth first. They set c.var.userId; the id comes from the session, never the
// client.

// Checks the session in Postgres, so a revoked session stops at once. For anything that
// reads or writes data.
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({
    headers: c.req.raw.headers,
    query: { disableCookieCache: true },
  });
  if (!session) return c.json({ error: 'unauthenticated' }, 401);
  c.set('userId', session.user.id);
  await next();
});

// Trusts the signed session cookie cache, up to its maxAge, without touching Postgres.
// Only for /api/sync/version, which answers a number and nothing else.
export const requireCachedSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'unauthenticated' }, 401);
  c.set('userId', session.user.id);
  await next();
});
