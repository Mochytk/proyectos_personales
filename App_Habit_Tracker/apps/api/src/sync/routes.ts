import { pushRequestSchema } from '@habit-tracker/shared';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { AppEnv } from '../app';
import { requireSession, withAuth } from '../auth/session';
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
      return c.json(await push(c.var.db, c.var.userId, parsed.data));
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

  return sync;
}
