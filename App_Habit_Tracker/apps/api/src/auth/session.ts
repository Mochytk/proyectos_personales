import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../app';
import { openDb } from '../db/client';
import { createAuth } from './auth';

// Opens the database and Better Auth for this request only, and closes the pool once the
// response is on its way. Only routes that need the database use it.
export const withAuth = createMiddleware<AppEnv>(async (c, next) => {
  const { db, close } = openDb({
    DATABASE_URL: c.env.DATABASE_URL,
    DATABASE_DRIVER: c.env.DATABASE_DRIVER,
  });
  c.set('db', db);
  c.set('auth', createAuth(c.env, db, c.req.url));
  try {
    await next();
  } finally {
    c.executionCtx.waitUntil(close());
  }
});

// Needs withAuth first. Sets c.var.userId; the id comes from the session, never the client.
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: 'unauthenticated' }, 401);
  c.set('userId', session.user.id);
  await next();
});
