import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Auth } from './auth/auth';
import { withAuth } from './auth/session';
import type { Db } from './db/client';

export interface AppEnv {
  Bindings: Env;
  // Set by withAuth and requireSession, on the routes that use them.
  Variables: { db: Db; auth: Auth; userId: string };
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(
    '/api/*',
    secureHeaders({ xFrameOptions: 'DENY', referrerPolicy: 'no-referrer' }),
    async (c, next) => {
      await next();
      c.header('Cache-Control', 'no-store');
    },
  );

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.all('/api/auth/*', withAuth, (c) => c.var.auth.handler(c.req.raw));

  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  // The cause goes to Workers Logs; the response never carries it.
  app.onError((error, c) => {
    console.error('Unhandled error', error.name, error.message);
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}
