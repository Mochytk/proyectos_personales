import { pullResponseSchema, type PullResponse, type PushResponse } from '@habit-tracker/shared';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { createTestDatabase, type TestDatabase } from '../test/db';
import { request, sessionCookie, testEnv } from '../test/app';

const PASSWORD = 'correct horse battery';
// In the past, so the 5-minute clamp never touches them.
const T0 = '2026-01-05T10:00:00.000Z';
const T1 = '2026-01-05T11:00:00.000Z';
const T2 = '2026-01-05T12:00:00.000Z';

let database: TestDatabase;
let client: pg.Client;
let ipCounter = 0;
let alice: string;
let bob: string;

function nextIp(): string {
  ipCounter += 1;
  return `192.0.2.${String(ipCounter)}`;
}

function call(path: string, init: { method?: string; json?: unknown; cookie?: string } = {}) {
  return request(createApp(), testEnv(database.url), path, { ...init, ip: nextIp() });
}

async function account(email: string): Promise<string> {
  await call('/api/auth/sign-up/email', {
    method: 'POST',
    json: { email, password: PASSWORD, name: 'Prueba' },
  });
  const signIn = await call('/api/auth/sign-in/email', {
    method: 'POST',
    json: { email, password: PASSWORD },
  });
  return sessionCookie(signIn);
}

function anchor(id: string, overrides: Record<string, unknown> = {}) {
  return {
    table: 'anchors',
    row: {
      id,
      createdAt: T0,
      updatedAt: T0,
      deletedAt: null,
      name: 'Al despertar',
      sortOrder: 0,
      archivedAt: null,
      ...overrides,
    },
  };
}

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

async function push(cookie: string, rows: unknown[]): Promise<Response> {
  return call('/api/sync/push', { method: 'POST', cookie, json: { rows } });
}

async function pushOk(cookie: string, rows: unknown[]): Promise<PushResponse> {
  const response = await push(cookie, rows);
  expect(response.status).toBe(200);
  return response.json<PushResponse>();
}

async function pull(cookie: string, cursor = 0): Promise<PullResponse> {
  const response = await call(`/api/sync/pull?cursor=${String(cursor)}`, { cookie });
  expect(response.status).toBe(200);
  return response.json<PullResponse>();
}

async function storedAnchor(userEmail: string, id: string) {
  const result = await client.query<{ name: string; updated_at: Date; server_seq: string }>(
    `SELECT a.name, a.updated_at, a.server_seq FROM anchors a JOIN "user" u ON u.id = a.user_id
      WHERE u.email = $1 AND a.id = $2`,
    [userEmail, id],
  );
  return result.rows[0];
}

beforeAll(async () => {
  database = await createTestDatabase();
  client = new pg.Client({ connectionString: database.url });
  await client.connect();
  alice = await account('alice@example.com');
  bob = await account('bob@example.com');
});

afterAll(async () => {
  await client.end();
  await database.drop();
});

describe('push', () => {
  it('changes nothing when the same batch arrives twice', async () => {
    const rows = [anchor(uuid(1)), anchor(uuid(2), { name: 'Antes de dormir' })];
    const first = await pushOk(alice, rows);
    const second = await pushOk(alice, rows);

    expect(first.accepted).toHaveLength(2);
    expect(second.accepted).toEqual(first.accepted);
    expect(second.stale).toEqual([]);
    expect(second.version).toBe(first.version);
  });

  it('keeps the latest edit, and gives a tie to the row that arrives last', async () => {
    const id = uuid(10);
    await pushOk(alice, [anchor(id, { updatedAt: T1, name: 'Uno' })]);

    const older = await pushOk(alice, [anchor(id, { updatedAt: T0, name: 'Vieja' })]);
    expect(older.stale).toEqual([{ table: 'anchors', id }]);
    expect((await storedAnchor('alice@example.com', id))?.name).toBe('Uno');

    const tie = await pushOk(alice, [anchor(id, { updatedAt: T1, name: 'Empate' })]);
    expect(tie.accepted).toHaveLength(1);
    expect((await storedAnchor('alice@example.com', id))?.name).toBe('Empate');

    await pushOk(alice, [anchor(id, { updatedAt: T2, name: 'Nueva' })]);
    expect((await storedAnchor('alice@example.com', id))?.name).toBe('Nueva');
  });

  it('brings an updated_at from the year 2100 back to 5 minutes from now', async () => {
    const id = uuid(20);
    const before = Date.now();
    await pushOk(alice, [anchor(id, { updatedAt: '2100-01-01T00:00:00.000Z' })]);
    const stored = await storedAnchor('alice@example.com', id);
    const ahead = (stored?.updated_at.getTime() ?? 0) - before;
    expect(ahead).toBeGreaterThan(4 * 60 * 1000);
    expect(ahead).toBeLessThanOrEqual(5 * 60 * 1000 + 5000);
  });

  it('writes nothing when one row of the batch is invalid', async () => {
    const response = await push(alice, [anchor(uuid(30)), anchor(uuid(31), { name: '' })]);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_batch' });
    expect(await storedAnchor('alice@example.com', uuid(30))).toBeUndefined();
  });

  it('gives two simultaneous pushes distinct sequences and loses no row', async () => {
    const batchA = Array.from({ length: 50 }, (_, i) => anchor(uuid(1000 + i)));
    const batchB = Array.from({ length: 50 }, (_, i) => anchor(uuid(2000 + i)));
    const [a, b] = await Promise.all([pushOk(alice, batchA), pushOk(alice, batchB)]);

    const seqs = [...a.accepted, ...b.accepted].map((row) => row.serverSeq);
    expect(new Set(seqs).size).toBe(100);
    const ids = [...batchA, ...batchB].map((item) => item.row.id);
    const stored = await client.query(
      `SELECT 1 FROM anchors a JOIN "user" u ON u.id = a.user_id
        WHERE u.email = 'alice@example.com' AND a.id = ANY($1::uuid[])`,
      [ids],
    );
    expect(stored.rowCount).toBe(100);
  });
});

describe('isolation between users', () => {
  it('never shows one user the rows of another, even with the same id', async () => {
    const id = uuid(40);
    await pushOk(alice, [anchor(id, { name: 'De Alice' })]);
    await pushOk(bob, [anchor(id, { name: 'De Bob' })]);

    expect((await storedAnchor('alice@example.com', id))?.name).toBe('De Alice');
    expect((await storedAnchor('bob@example.com', id))?.name).toBe('De Bob');

    const page = await pull(bob);
    expect(page.rows.map((row) => row.row.id)).toEqual([id]);
    expect(page.rows[0]?.row).toMatchObject({ name: 'De Bob' });
  });
});

describe('pull', () => {
  it('pages 1,200 rows in pages of 500 without repeating or skipping any', async () => {
    const carol = await account('carol@example.com');
    const ids = Array.from({ length: 1200 }, (_, i) => uuid(50_000 + i));
    for (let i = 0; i < ids.length; i += 200) {
      await pushOk(
        carol,
        ids.slice(i, i + 200).map((id) => anchor(id)),
      );
    }

    const seen: string[] = [];
    const sizes: number[] = [];
    let cursor = 0;
    for (;;) {
      const page = await pull(carol, cursor);
      sizes.push(page.rows.length);
      seen.push(...page.rows.map((row) => row.row.id));
      expect(page.cursor).toBeGreaterThan(cursor);
      cursor = page.cursor;
      if (!page.hasMore) break;
    }
    expect(sizes).toEqual([500, 500, 200]);
    expect(new Set(seen).size).toBe(1200);
    expect(new Set(seen)).toEqual(new Set(ids));

    const empty = await pull(carol, cursor);
    expect(empty).toEqual({ rows: [], cursor, hasMore: false });
  });

  it('includes soft deletes, and returns rows the client schema accepts', async () => {
    const id = uuid(60);
    await pushOk(alice, [anchor(id, { deletedAt: T1, updatedAt: T1 })]);
    const page = await pull(alice);
    expect(pullResponseSchema.safeParse(page).success).toBe(true);
    const row = page.rows.find((r) => r.row.id === id);
    expect(row).toMatchObject({ table: 'anchors', row: { id, deletedAt: T1, updatedAt: T1 } });
    expect(row?.row).not.toHaveProperty('userId');
  });

  it('rejects a cursor that is not a whole number', async () => {
    const response = await call('/api/sync/pull?cursor=-1', { cookie: alice });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_cursor' });
  });
});

describe('without a session', () => {
  it('answers 401 to push and pull', async () => {
    expect((await push('', [anchor(uuid(70))])).status).toBe(401);
    expect((await call('/api/sync/pull?cursor=0')).status).toBe(401);
  });
});
