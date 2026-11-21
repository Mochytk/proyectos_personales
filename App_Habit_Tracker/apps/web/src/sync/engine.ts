import { PUSH_BATCH_MAX, SYNC_TABLES, wins, type SyncRow } from '@habit-tracker/shared';
import type { HabitDb, OutboxEntry, SyncedTable, SyncStateRow } from '../db/db';
import type { ApiResult, SyncApi } from './sync-api';

export type SyncResult =
  | { status: 'synced' }
  | { status: 'offline' }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string };

const STATE_ID = 'sync';
const TABLE_ORDER = new Map<SyncedTable, number>(SYNC_TABLES.map((table, i) => [table, i]));

type Failure = Exclude<SyncResult, { status: 'synced' }>;

function failureOf(result: Exclude<ApiResult<unknown>, { status: 'ok' }>): Failure {
  return result.status === 'error' ? { status: 'error', message: result.message } : result;
}

function syncedTables(db: HabitDb) {
  return SYNC_TABLES.map((table) => db.table(table));
}

// One full round (ADR 0006): push the outbox, then pull until the server has no more.
// Safe to repeat at any point: a push the server already applied changes nothing there.
export async function syncOnce(db: HabitDb, api: SyncApi): Promise<SyncResult> {
  const result = (await pushOutbox(db, api)) ?? (await pullAll(db, api)) ?? { status: 'synced' };
  await recordResult(db, result);
  return result;
}

async function pushOutbox(db: HabitDb, api: SyncApi): Promise<Failure | undefined> {
  // Parents first, then oldest first, so a page the other device pulls is in order.
  const entries = (await db.outbox.toArray()).sort(
    (a, b) =>
      (TABLE_ORDER.get(a.table) ?? 0) - (TABLE_ORDER.get(b.table) ?? 0) ||
      a.queuedAt.localeCompare(b.queuedAt),
  );

  for (let i = 0; i < entries.length; i += PUSH_BATCH_MAX) {
    const batch = entries.slice(i, i + PUSH_BATCH_MAX);
    const rows = await rowsFor(db, batch);
    if (rows.length === 0) continue;
    // What each row looked like when it left, to tell later whether it changed meanwhile.
    const sent = new Map(rows.map((item) => [key(item.table, item.row.id), item.row.updatedAt]));

    const result = await api.push({ rows });
    if (result.status !== 'ok') return failureOf(result);

    // Accepted rows are on the server; stale ones lost to a newer edit there, which the
    // pull brings back. Either way they leave the outbox, unless edited while in flight.
    const done = [...result.data.accepted, ...result.data.stale];
    await db.transaction('rw', [db.outbox, ...syncedTables(db)], async () => {
      for (const { table, id } of done) {
        const row = (await db.table(table).get(id)) as { updatedAt: string } | undefined;
        if (row?.updatedAt === sent.get(key(table, id))) await db.outbox.delete([table, id]);
      }
    });
  }
  return undefined;
}

async function rowsFor(db: HabitDb, entries: OutboxEntry[]): Promise<SyncRow[]> {
  const rows: SyncRow[] = [];
  for (const entry of entries) {
    const row: unknown = await db.table(entry.table).get(entry.id);
    if (row === undefined) {
      // Rows are only soft-deleted, so this is a leftover with nothing to send.
      await db.outbox.delete([entry.table, entry.id]);
      continue;
    }
    rows.push({ table: entry.table, row } as SyncRow);
  }
  return rows;
}

async function pullAll(db: HabitDb, api: SyncApi): Promise<Failure | undefined> {
  let cursor = (await db.syncState.get(STATE_ID))?.cursor ?? 0;
  for (;;) {
    const result = await api.pull(cursor);
    if (result.status !== 'ok') return failureOf(result);
    const page = result.data;

    // Rows from the server go straight to their tables, not through writeRows: they are
    // already synced and must not be queued again.
    await db.transaction('rw', [db.syncState, db.outbox, ...syncedTables(db)], async () => {
      for (const { table, row } of page.rows) {
        const local = (await db.table(table).get(row.id)) as { updatedAt: string } | undefined;
        if (!wins(row, local)) continue;
        await db.table(table).put(row);
        // A local edit the server's copy beats is gone everywhere; nothing left to push.
        await db.outbox.delete([table, row.id]);
      }
      await saveState(db, { cursor: page.cursor });
    });

    cursor = page.cursor;
    if (!page.hasMore) return undefined;
  }
}

async function recordResult(db: HabitDb, result: SyncResult): Promise<void> {
  const now = new Date().toISOString();
  await saveState(
    db,
    result.status === 'synced'
      ? { lastSuccessAt: now, lastError: null }
      : {
          lastErrorAt: now,
          lastError: result.status === 'error' ? result.message : result.status,
        },
  );
}

async function saveState(db: HabitDb, patch: Partial<Omit<SyncStateRow, 'id'>>): Promise<void> {
  const current = await db.syncState.get(STATE_ID);
  await db.syncState.put({
    id: STATE_ID,
    cursor: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastError: null,
    ...current,
    ...patch,
  });
}

function key(table: string, id: string): string {
  return `${table}:${id}`;
}
