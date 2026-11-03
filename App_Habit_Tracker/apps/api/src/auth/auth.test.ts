import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createTestDatabase, type TestDatabase } from '../test/db';
import { request, sessionCookie, testEnv } from '../test/app';
import { requireSession, withAuth } from './session';

const PASSWORD = 'correct horse battery';

let database: TestDatabase;
let client: pg.Client;
let ipCounter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
  client = new pg.Client({ connectionString: database.url });
  await client.connect();
});

afterAll(async () => {
  await client.end();
  await database.drop();
});

// Each test gets its own client IP, so the rate limit of one never trips another.
function nextIp(): string {
  ipCounter += 1;
  return `203.0.113.${String(ipCounter)}`;
}

function app() {
  const app = createApp();
  app.get('/api/test/me', withAuth, requireSession, (c) => c.json({ userId: c.var.userId }));
  return app;
}

async function signUp(email: string, env = testEnv(database.url), ip = nextIp()) {
  return request(app(), env, '/api/auth/sign-up/email', {
    method: 'POST',
    ip,
    json: { email, password: PASSWORD, name: 'Prueba' },
  });
}

async function signIn(email: string, password = PASSWORD, ip = nextIp(), base = '') {
  const env = testEnv(database.url, base ? { AUTH_ALLOWED_HOSTS: new URL(base).host } : {});
  return request(app(), env, `${base}/api/auth/sign-in/email`, {
    method: 'POST',
    ip,
    json: { email, password },
  });
}

async function me(cookie?: string) {
  return request(app(), testEnv(database.url), '/api/test/me', { cookie, ip: nextIp() });
}

async function countUsers(email: string): Promise<number> {
  const result = await client.query('SELECT 1 FROM "user" WHERE email = $1', [email]);
  return result.rowCount ?? 0;
}

describe('sign-up', () => {
  it('creates no user while sign-up is closed', async () => {
    const response = await signUp(
      'cerrado@example.com',
      testEnv(database.url, { AUTH_SIGNUP_ENABLED: 'false' }),
    );
    expect(response.ok).toBe(false);
    expect(await countUsers('cerrado@example.com')).toBe(0);
  });

  it('creates the user when sign-up is open', async () => {
    const response = await signUp('abierto@example.com');
    expect(response.status).toBe(200);
    expect(await countUsers('abierto@example.com')).toBe(1);
  });

  it('rejects a password shorter than 12 characters', async () => {
    const response = await request(app(), testEnv(database.url), '/api/auth/sign-up/email', {
      method: 'POST',
      ip: nextIp(),
      json: { email: 'corta@example.com', password: '12345678901', name: 'Prueba' },
    });
    expect(response.status).toBe(400);
    expect(await countUsers('corta@example.com')).toBe(0);
  });
});

describe('sign-in', () => {
  beforeAll(async () => {
    await signUp('login@example.com');
  });

  it('sets an HttpOnly, SameSite=Lax session cookie, not Secure on localhost', async () => {
    const response = await signIn('login@example.com');
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().find((c) => c.includes('session_token='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it('marks the session cookie Secure on any other host', async () => {
    const response = await signIn(
      'login@example.com',
      PASSWORD,
      nextIp(),
      'https://constancia.example.workers.dev',
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.getSetCookie().find((c) => c.includes('session_token='));
    expect(cookie).toMatch(/; Secure/i);
  });

  it('answers 429 to the fourth failed attempt within 10 seconds', async () => {
    const ip = nextIp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await signIn('login@example.com', 'wrong password!!', ip)).status);
    }
    expect(statuses.slice(0, 3).every((status) => status === 401)).toBe(true);
    expect(statuses[3]).toBe(429);
  });
});

describe('sessions', () => {
  it('answers 401 on a protected route without a session', async () => {
    const response = await me();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthenticated' });
  });

  it('lets the session through and ends it on sign-out', async () => {
    await signUp('salir@example.com');
    const cookie = sessionCookie(await signIn('salir@example.com'));
    const user = await client.query<{ id: string }>('SELECT id FROM "user" WHERE email = $1', [
      'salir@example.com',
    ]);
    expect(await (await me(cookie)).json()).toEqual({ userId: user.rows[0]?.id });

    const out = await request(app(), testEnv(database.url), '/api/auth/sign-out', {
      method: 'POST',
      ip: nextIp(),
      cookie,
      json: {},
    });
    expect(out.status).toBe(200);
    expect((await me(cookie)).status).toBe(401);
  });

  it('closes the other sessions and keeps this one', async () => {
    await signUp('otras@example.com');
    const phone = sessionCookie(await signIn('otras@example.com'));
    const mac = sessionCookie(await signIn('otras@example.com'));

    const response = await request(
      app(),
      testEnv(database.url),
      '/api/auth/revoke-other-sessions',
      {
        method: 'POST',
        ip: nextIp(),
        cookie: phone,
        json: {},
      },
    );
    expect(response.status).toBe(200);
    expect((await me(phone)).status).toBe(200);
    expect((await me(mac)).status).toBe(401);
  });

  it('closes the other sessions when the password changes', async () => {
    await signUp('clave@example.com');
    const phone = sessionCookie(await signIn('clave@example.com'));
    const mac = sessionCookie(await signIn('clave@example.com'));

    const response = await request(app(), testEnv(database.url), '/api/auth/change-password', {
      method: 'POST',
      ip: nextIp(),
      cookie: phone,
      json: {
        currentPassword: PASSWORD,
        newPassword: 'a brand new passphrase',
        revokeOtherSessions: true,
      },
    });
    expect(response.status).toBe(200);
    // Better Auth issues a fresh session for this device when it revokes the others.
    const refreshed = response.headers.getSetCookie().length > 0 ? sessionCookie(response) : phone;
    expect((await me(refreshed)).status).toBe(200);
    expect((await me(mac)).status).toBe(401);
    expect((await signIn('clave@example.com')).status).toBe(401);
  });
});
