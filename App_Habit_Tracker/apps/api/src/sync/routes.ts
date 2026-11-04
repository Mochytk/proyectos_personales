import { pushRequestSchema } from '@habit-tracker/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../app';
import { requireCachedSession, requireSession, withAuth } from '../auth/session';
import { announce } from './notifier';
import { pull } from './pull';
import { push } from './push';

// A full batch of 200 rows is far below this; anything larger is not a client of ours.
const MAX_PUSH_BYTES = 1024 * 1024;

export function syncRoutes(): Hono<AppEnv> {
  const sync = new Hono<AppEnv>();

  sync.post(
    '/push',
    bodyLimit({
      maxSize: MAX_PUSH_BYTES,
      onError: (c) => c.json({ error: 'payload_too_large' }, 413),
    }),
    withAuth,
    requireSession,
    async (c) => {
      const body: unknown = await c.req.json().catch(() => null);
      const parsed = pushRequestSchema.safeParse(body);
      if (!parsed.success) return c.json({ error: 'invalid_batch' }, 400);
      const result = await push(c.var.db, c.var.userId, parsed.data);
      // After the commit, without holding up the response.
      c.executionCtx.waitUntil(announce(c.var.services.notifier(), c.var.userId, result.version));
      return c.json(result);
    },
  );

  sync.get('/pull', withAuth, requireSession, async (c) => {
    const raw = c.req.query('cursor') ?? '0';
    const cursor = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(cursor)) {
      return c.json({ error: 'invalid_cursor' }, 400);
    }
    return c.json(await pull(c.var.db, c.var.userId, cursor));
  });

  // Polled every 15 s while the app is open (ADR 0006): answered by the Durable Object,
  // with the session from its signed cookie, so Neon can stay asleep.
  sync.get('/version', withAuth, requireCachedSession, async (c) =>
    c.json({ version: await c.var.services.notifier().version(c.var.userId) }),
  );

  return sync;
}
