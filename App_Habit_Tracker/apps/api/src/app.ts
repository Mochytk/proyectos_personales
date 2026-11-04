import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Auth } from './auth/auth';
import { withAuth } from './auth/session';
import { openDb, type Db, type OpenDb } from './db/client';
import { brevoSender } from './email/brevo';
import type { EmailSender } from './email/sender';
import { durableNotifier, type ChangeNotifier } from './sync/notifier';
import { syncRoutes } from './sync/routes';

export interface AppEnv {
  Bindings: Env;
  // services on every /api/* request; db, auth and userId by withAuth and the session
  // middlewares, on the routes that use them.
  Variables: { services: Services; db: Db; auth: Auth; userId: string };
}

// Built only when a route asks, so /api/health reads no binding at all.
export interface Services {
  email: () => EmailSender;
  notifier: () => ChangeNotifier;
  connect: () => OpenDb;
}

// The Worker's real services by default; tests swap any of them.
export interface AppOptions {
  email?: (env: Env) => EmailSender;
  notifier?: (env: Env) => ChangeNotifier;
  connect?: (env: Env) => OpenDb;
}

export function createApp({
  email = (env) => brevoSender(env),
  notifier = (env) => durableNotifier(env.SYNC_NOTIFIER),
  connect = (env) =>
    openDb({ DATABASE_URL: env.DATABASE_URL, DATABASE_DRIVER: env.DATABASE_DRIVER }),
}: AppOptions = {}): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use(
    '/api/*',
    secureHeaders({ xFrameOptions: 'DENY', referrerPolicy: 'no-referrer' }),
    async (c, next) => {
      c.set('services', {
        email: () => email(c.env),
        notifier: () => notifier(c.env),
        connect: () => connect(c.env),
      });
      await next();
      c.header('Cache-Control', 'no-store');
    },
  );

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.all('/api/auth/*', withAuth, (c) => c.var.auth.handler(c.req.raw));

  app.route('/api/sync', syncRoutes());

  app.notFound((c) => c.json({ error: 'not_found' }, 404));

  // The cause goes to Workers Logs; the response never carries it.
  app.onError((error, c) => {
    console.error('Unhandled error', error.name, error.message);
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}
