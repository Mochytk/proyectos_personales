import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

export interface AppEnv {
  Bindings: Env;
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

  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  // The cause goes to Workers Logs; the response never carries it.
  app.onError((error, c) => {
    console.error('Unhandled error', error.name, error.message);
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}
