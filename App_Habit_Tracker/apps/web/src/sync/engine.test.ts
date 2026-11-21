import {
  wins,
  type Anchor,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type SyncRow,
} from '@habit-tracker/shared';
import { describe, expect, it } from 'vitest';
import type { HabitDb } from '../db/db';
import { writeRows } from '../db/write';
import { openTestDb } from '../test/db';
import { syncOnce } from './engine';
import type { ApiResult, SyncApi } from './sync-api';

const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-01T11:00:00.000Z';
const T2 = '2026-11-01T12:00:00.000Z';

function anchor(n: number, overrides: Partial<Anchor> = {}): Anchor {
  return {
    id: `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`,
    createdAt: T0,
    updatedAt: T0,
    deletedAt: null,
    name: `Ancla ${String(n)}`,
    sortOrder: n,
    archivedAt: null,
    ...overrides,
  };
}

// The server's rules in memory: last write wins, identical rows change nothing, and
// each accepted row gets the next sequence (ADR 0006).
class FakeServer implements SyncApi {
  rows = new Map<string, { item: SyncRow; serverSeq: number }>();
  seq = 0;
  pushes: PushRequest[] = [];
  pageSize = 500;
  // What the next calls answer instead of the real result, in order.
  failures: ApiResult<never>['status'][] = [];
  // Applies the push but loses the response, as a dropped connection would.
  loseNextPushResponse = false;

  private fail<T>(): ApiResult<T> | undefined {
    const status = this.failures.shift();
    if (status === undefined) return undefined;
    return status === 'error' ? { status, message: 'boom' } : ({ status } as ApiResult<T>);
  }

  push(request: PushRequest): Promise<ApiResult<PushResponse>> {
    const failed = this.fail<PushResponse>();
    if (failed) return Promise.resolve(failed);
    this.pushes.push(request);
    const accepted: PushResponse['accepted'] = [];
    const stale: PushResponse['stale'] = [];
    for (const item of request.rows) {
      const key = `${item.table}:${item.row.id}`;
      const existing = this.rows.get(key);
      if (existing && !wins(item.row, existing.item.row)) {
        stale.push({ table: item.table, id: item.row.id });
      } else if (existing && JSON.stringify(existing.item.row) === JSON.stringify(item.row)) {
        accepted.push({ table: item.table, id: item.row.id, serverSeq: existing.serverSeq });
      } else {
        this.seq += 1;
        this.rows.set(key, { item, serverSeq: this.seq });
        accepted.push({ table: item.table, id: item.row.id, serverSeq: this.seq });
      }
    }
    if (this.loseNextPushResponse) {
      this.loseNextPushResponse = false;
      return Promise.resolve({ status: 'offline' });
    }
    return Promise.resolve({ status: 'ok', data: { accepted, stale, version: this.seq } });
  }

  pull(cursor: number): Promise<ApiResult<PullResponse>> {
    const failed = this.fail<PullResponse>();
    if (failed) return Promise.resolve(failed);
    const after = [...this.rows.values()]
      .filter((r) => r.serverSeq > cursor)
      .sort((a, b) => a.serverSeq - b.serverSeq);
    const page = after.slice(0, this.pageSize);
    return Promise.resolve({
      status: 'ok',
      data: {
        rows: page.map((r) => ({ ...r.item, serverSeq: r.serverSeq })),
        cursor: page.at(-1)?.serverSeq ?? cursor,
        hasMore: after.length > this.pageSize,
      },
    });
  }

  version(): Promise<ApiResult<number>> {
    return Promise.resolve({ status: 'ok', data: this.seq });
  }

  // A change made on the other device.
  remote(row: Anchor) {
    this.seq += 1;
    this.rows.set(`anchors:${row.id}`, { item: { table: 'anchors', row }, serverSeq: this.seq });
  }
}

async function outboxIds(db: HabitDb): Promise<string[]> {
  return (await db.outbox.toArray()).map((entry) => entry.id).sort();
}

describe('syncOnce', () => {
  it('pushes the outbox and empties it', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    await writeRows(db, 'anchors', [anchor(1), anchor(2)], T1);

    expect(await syncOnce(db, server)).toEqual({ status: 'synced' });
    expect(await outboxIds(db)).toEqual([]);
    expect(server.rows.size).toBe(2);
  });

  it('keeps in the outbox a row edited while the push was travelling', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    await writeRows(db, 'anchors', [anchor(1), anchor(2)], T1);
    const push = server.push.bind(server);
    server.push = async (request) => {
      const result = await push(request);
      await writeRows(db, 'anchors', [anchor(2, { name: 'Editada' })], T2);
      return result;
    };

    await syncOnce(db, server);
    expect(await outboxIds(db)).toEqual([anchor(2).id]);
  });

  it('sends batches of at most 200 rows', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    await writeRows(
      db,
      'anchors',
      Array.from({ length: 450 }, (_, i) => anchor(i + 1)),
      T1,
    );

    await syncOnce(db, server);
    expect(server.pushes.map((p) => p.rows.length)).toEqual([200, 200, 50]);
    expect(await outboxIds(db)).toEqual([]);
  });

  it('applies a newer remote row and keeps the local one when it is newer', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    await db.anchors.bulkPut([anchor(1, { updatedAt: T1 }), anchor(2, { updatedAt: T1 })]);
    server.remote(anchor(1, { updatedAt: T2, name: 'Desde el Mac' }));
    server.remote(anchor(2, { updatedAt: T0, name: 'Vieja' }));

    await syncOnce(db, server);
    expect((await db.anchors.get(anchor(1).id))?.name).toBe('Desde el Mac');
    expect((await db.anchors.get(anchor(2).id))?.name).toBe('Ancla 2');
    // Applying what came from the server queues nothing.
    expect(await outboxIds(db)).toEqual([]);
  });

  it('pulls every page and keeps the cursor at the last one', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    server.pageSize = 2;
    for (let i = 1; i <= 5; i += 1) server.remote(anchor(i));

    await syncOnce(db, server);
    expect(await db.anchors.count()).toBe(5);
    expect((await db.syncState.get('sync'))?.cursor).toBe(5);

    // The next sync asks only for what came after.
    server.remote(anchor(6));
    await syncOnce(db, server);
    expect(await db.anchors.count()).toBe(6);
    expect((await db.syncState.get('sync'))?.cursor).toBe(6);
  });

  it('reports a closed session and keeps the outbox', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    server.failures = ['unauthenticated'];
    await writeRows(db, 'anchors', [anchor(1)], T1);

    expect(await syncOnce(db, server)).toEqual({ status: 'unauthenticated' });
    expect(await outboxIds(db)).toEqual([anchor(1).id]);
  });

  it('reports a lost connection, keeps the outbox and records the failure', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    server.failures = ['offline'];
    await writeRows(db, 'anchors', [anchor(1)], T1);

    expect(await syncOnce(db, server)).toEqual({ status: 'offline' });
    expect(await outboxIds(db)).toEqual([anchor(1).id]);
  });

  it('reports a server error with its message', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    server.failures = ['error'];
    await writeRows(db, 'anchors', [anchor(1)], T1);

    expect(await syncOnce(db, server)).toEqual({ status: 'error', message: 'boom' });
    const state = await db.syncState.get('sync');
    expect(state?.lastError).toBe('boom');
  });

  it('leaves everything the same when a push is repeated after its response was lost', async () => {
    const db = await openTestDb();
    const server = new FakeServer();
    await writeRows(db, 'anchors', [anchor(1), anchor(2)], T1);
    server.loseNextPushResponse = true;

    expect(await syncOnce(db, server)).toEqual({ status: 'offline' });
    expect(await outboxIds(db)).toHaveLength(2);
    const seqAfterFirst = server.seq;

    expect(await syncOnce(db, server)).toEqual({ status: 'synced' });
    expect(server.seq).toBe(seqAfterFirst);
    expect(await outboxIds(db)).toEqual([]);
    expect(await db.anchors.count()).toBe(2);
  });
});
