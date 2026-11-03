import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app';
import type { EmailMessage, EmailSender } from '../email/sender';
import { createTestDatabase, type TestDatabase } from '../test/db';
import { request, sessionCookie, testEnv } from '../test/app';
import { requireSession, withAuth } from './session';

const OLD_PASSWORD = 'correct horse battery';
const NEW_PASSWORD = 'a brand new passphrase';

let database: TestDatabase;
let client: pg.Client;
let ipCounter = 0;
let sent: EmailMessage[] = [];

const fakeSender: EmailSender = {
  send(message) {
    sent.push(message);
    return Promise.resolve();
  },
};

beforeAll(async () => {
  database = await createTestDatabase();
  client = new pg.Client({ connectionString: database.url });
  await client.connect();
});

afterAll(async () => {
  await client.end();
  await database.drop();
});

function nextIp(): string {
  ipCounter += 1;
  return `198.51.100.${String(ipCounter)}`;
}

function app() {
  const app = createApp({ email: () => fakeSender });
  app.get('/api/test/me', withAuth, requireSession, (c) => c.json({ userId: c.var.userId }));
  return app;
}

function post(path: string, json: unknown, cookie?: string) {
  return request(app(), testEnv(database.url), path, {
    method: 'POST',
    ip: nextIp(),
    json,
    cookie,
  });
}

async function signIn(email: string, password: string) {
  return post('/api/auth/sign-in/email', { email, password });
}

async function requestReset(email: string) {
  sent = [];
  return post('/api/auth/request-password-reset', { email });
}

// The token is the last path segment of the link in the email.
function tokenFrom(message: EmailMessage | undefined): string {
  const match = /\/reset-password\/([^?\s]+)/.exec(message?.text ?? '');
  if (!match?.[1]) throw new Error('No reset link in the email');
  return match[1];
}

describe('password reset by email', () => {
  beforeAll(async () => {
    await post('/api/auth/sign-up/email', {
      email: 'olvido@example.com',
      password: OLD_PASSWORD,
      name: 'Prueba',
    });
  });

  it('emails a reset link in Spanish that expires in one hour', async () => {
    const response = await requestReset('olvido@example.com');
    expect(response.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('olvido@example.com');
    expect(sent[0]?.subject).toBe('Restablecer tu contraseña de Constancia');
    expect(sent[0]?.text).toContain('1 hora');

    const token = tokenFrom(sent[0]);
    const row = await client.query<{ minutes: number }>(
      `SELECT extract(epoch FROM expires_at - now()) / 60 AS minutes
         FROM verification WHERE identifier = $1`,
      [`reset-password:${token}`],
    );
    expect(Number(row.rows[0]?.minutes)).toBeGreaterThan(58);
    expect(Number(row.rows[0]?.minutes)).toBeLessThanOrEqual(60);
  });

  it('answers the same for an unknown address and sends nothing', async () => {
    const known = await (await requestReset('olvido@example.com')).json();
    const unknown = await requestReset('nadie@example.com');
    expect(unknown.status).toBe(200);
    expect(await unknown.json()).toEqual(known);
    expect(sent).toHaveLength(0);
  });

  it('resets the password once, and closes every session', async () => {
    const phone = sessionCookie(await signIn('olvido@example.com', OLD_PASSWORD));
    const mac = sessionCookie(await signIn('olvido@example.com', OLD_PASSWORD));

    await requestReset('olvido@example.com');
    const token = tokenFrom(sent[0]);

    const reset = await post('/api/auth/reset-password', { token, newPassword: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    expect((await signIn('olvido@example.com', OLD_PASSWORD)).status).toBe(401);
    expect((await signIn('olvido@example.com', NEW_PASSWORD)).status).toBe(200);
    for (const cookie of [phone, mac]) {
      const me = await request(app(), testEnv(database.url), '/api/test/me', {
        cookie,
        ip: nextIp(),
      });
      expect(me.status).toBe(401);
    }

    const again = await post('/api/auth/reset-password', {
      token,
      newPassword: 'yet another passphrase',
    });
    expect(again.status).toBe(400);
    expect((await signIn('olvido@example.com', NEW_PASSWORD)).status).toBe(200);
  });

  it('answers the same when Brevo fails, and logs only the error code', async () => {
    const failing = createApp({
      email: () => ({ send: () => Promise.reject(new Error('Brevo answered 401 (unauthorized)')) }),
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await request(
        failing,
        testEnv(database.url),
        '/api/auth/request-password-reset',
        {
          method: 'POST',
          ip: nextIp(),
          json: { email: 'olvido@example.com' },
        },
      );
      expect(response.status).toBe(200);
      expect(log).toHaveBeenCalledWith('Reset email failed', 'Brevo answered 401 (unauthorized)');
    } finally {
      log.mockRestore();
    }
  });
});
