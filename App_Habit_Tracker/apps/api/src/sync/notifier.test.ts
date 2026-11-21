import type { PushResponse } from '@habit-tracker/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, type AppOptions } from '../app';
import type { Db } from '../db/client';
import { createTestDatabase, type TestDatabase } from '../test/db';
import { cookies, request, testEnv } from '../test/app';
import { memoryNotifier, type ChangeNotifier } from './notifier';
import { SyncNotifier } from './sync-notifier';

const PASSWORD = 'correct horse battery';
const PAST = '2026-01-05T10:00:00.000Z';

let database: TestDatabase;
let ipCounter = 0;

beforeAll(async () => {
  database = await createTestDatabase();
});

afterAll(async () => {
  await database.drop();
});

function call(
  options: AppOptions,
  path: string,
  init: { method?: string; json?: unknown; cookie?: string } = {},
) {
  ipCounter += 1;
  return request(createApp(options), testEnv(database.url), path, {
    ...init,
    ip: `203.0.113.${String(ipCounter)}`,
  });
}

async function account(email: string, options: AppOptions): Promise<string> {
  await call(options, '/api/auth/sign-up/email', {
    method: 'POST',
    json: { email, password: PASSWORD, name: 'Prueba' },
  });
  const signIn = await call(options, '/api/auth/sign-in/email', {
    method: 'POST',
    json: { email, password: PASSWORD },
  });
  return cookies(signIn);
}

function anchorRow(id: string) {
  return {
    table: 'anchors',
    row: {
      id,
      createdAt: PAST,
      updatedAt: PAST,
      deletedAt: null,
      name: 'Al despertar',
      sortOrder: 0,
      archivedAt: null,
    },
  };
}

function fakeState(): DurableObjectState {
  const values = new Map<string, unknown>();
  return {
    storage: {
      kv: {
        get: (key: string) => values.get(key),
        put: (key: string, value: unknown) => {
          values.set(key, value);
        },
      },
    },
  } as unknown as DurableObjectState;
}

describe('SyncNotifier', () => {
  it('keeps the highest sequence it was told about', async () => {
    const notifier = new SyncNotifier(fakeState(), {} as Env);
    expect(await notifier.version()).toBe(0);
    await notifier.bump(5);
    await notifier.bump(3);
    expect(await notifier.version()).toBe(5);
    await notifier.bump(9);
    expect(await notifier.version()).toBe(9);
  });
});

describe('memoryNotifier', () => {
  it('keeps one version per user, and never lowers it', async () => {
    const notifier = memoryNotifier();
    await notifier.bump('a', 7);
    await notifier.bump('a', 2);
    expect(await notifier.version('a')).toBe(7);
    expect(await notifier.version('b')).toBe(0);
  });
});

describe('GET /api/sync/version', () => {
  it('reflects the last push, for that user only', async () => {
    const notifier = memoryNotifier();
    const options = { notifier: () => notifier };
    const alice = await account('version-a@example.com', options);
    const bob = await account('version-b@example.com', options);

    const pushed = await call(options, '/api/sync/push', {
      method: 'POST',
      cookie: alice,
      json: { rows: [anchorRow('00000000-0000-4000-8000-000000000001')] },
    });
    const { version } = await pushed.json<PushResponse>();
    expect(version).toBeGreaterThan(0);

    const mine = await call(options, '/api/sync/version', { cookie: alice });
    expect(await mine.json()).toEqual({ version });
    const theirs = await call(options, '/api/sync/version', { cookie: bob });
    expect(await theirs.json()).toEqual({ version: 0 });
  });

  it('answers without touching Postgres', async () => {
    const notifier = memoryNotifier();
    const alice = await account('sin-base@example.com', { notifier: () => notifier });
    await notifier.bump('ignored-user', 1);

    const unusable = new Proxy(
      {},
      {
        get() {
          throw new Error('The database must not be used');
        },
      },
    ) as Db;
    const offline: AppOptions = {
      notifier: () => notifier,
      connect: () => ({ db: unusable, close: () => Promise.resolve() }),
    };
    const response = await call(offline, '/api/sync/version', { cookie: alice });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: 0 });
  });

  it('answers 401 without a session', async () => {
    const response = await call({ notifier: () => memoryNotifier() }, '/api/sync/version');
    expect(response.status).toBe(401);
  });
});

describe('a session closed from another device', () => {
  it('can no longer push or pull, even with its cached session cookie', async () => {
    const notifier = memoryNotifier();
    const options = { notifier: () => notifier };
    const phone = await account('cerrada@example.com', options);
    const signIn = await call(options, '/api/auth/sign-in/email', {
      method: 'POST',
      json: { email: 'cerrada@example.com', password: PASSWORD },
    });
    const mac = cookies(signIn);
    expect(mac).toContain('session_data=');

    const revoke = await call(options, '/api/auth/revoke-other-sessions', {
      method: 'POST',
      cookie: phone,
      json: {},
    });
    expect(revoke.status).toBe(200);

    const pushed = await call(options, '/api/sync/push', {
      method: 'POST',
      cookie: mac,
      json: { rows: [anchorRow('00000000-0000-4000-8000-000000000003')] },
    });
    expect(pushed.status).toBe(401);
    expect((await call(options, '/api/sync/pull?cursor=0', { cookie: mac })).status).toBe(401);
    // By design: /version trusts the cached cookie until it expires, and only says a number.
    expect((await call(options, '/api/sync/version', { cookie: mac })).status).toBe(200);
  });
});

describe('announcing a push', () => {
  it('retries a failed bump once and still answers the push', async () => {
    const bump = vi.fn(() => Promise.reject(new Error('Durable Object unavailable')));
    const failing: ChangeNotifier = { bump, version: () => Promise.resolve(0) };
    const options = { notifier: () => failing };
    const alice = await account('aviso@example.com', options);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await call(options, '/api/sync/push', {
        method: 'POST',
        cookie: alice,
        json: { rows: [anchorRow('00000000-0000-4000-8000-000000000002')] },
      });
      expect(response.status).toBe(200);
      expect(bump).toHaveBeenCalledTimes(2);
      expect(log).toHaveBeenCalledWith('Sync notify failed', 'Durable Object unavailable');
    } finally {
      log.mockRestore();
    }
  });
});
