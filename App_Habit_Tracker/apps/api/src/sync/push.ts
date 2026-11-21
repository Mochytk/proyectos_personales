import { clampUpdatedAt, wins, type PushRequest, type PushResponse } from '@habit-tracker/shared';
import { and, eq, max, sql } from 'drizzle-orm';
import { unionAll } from 'drizzle-orm/pg-core';
import type { Db } from '../db/client';
import { dbTable, sameContent, SYNC_DB_TABLES, toDbValues, type SyncDbTable } from './tables';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const nextSeq = sql`nextval('sync_seq')`;

// Applies a validated batch for one user, all or nothing (ADR 0006). The user comes from
// the session; the advisory lock keeps two pushes of the same user from interleaving, so
// each user's server_seq grows in commit order and pull never skips a row.
export async function push(
  db: Db,
  userId: string,
  request: PushRequest,
  now = new Date(),
): Promise<PushResponse> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    const accepted: PushResponse['accepted'] = [];
    const stale: PushResponse['stale'] = [];

    for (const { table, row } of request.rows) {
      const t = dbTable(table);
      const incoming = { ...row, updatedAt: clampUpdatedAt(row.updatedAt, now) };
      const values = toDbValues(table, incoming, userId);
      const [existing] = await tx
        .select()
        .from(t)
        .where(and(eq(t.userId, userId), eq(t.id, row.id)))
        .limit(1);

      if (existing && !wins(incoming, { updatedAt: existing.updatedAt.toISOString() })) {
        stale.push({ table, id: row.id });
        continue;
      }
      // A repeated push changes nothing, not even server_seq.
      if (existing && sameContent(existing, values)) {
        accepted.push({ table, id: row.id, serverSeq: existing.serverSeq });
        continue;
      }
      const [saved] = await tx
        .insert(t)
        .values({ ...values, serverSeq: nextSeq } as never)
        .onConflictDoUpdate({ target: [t.userId, t.id], set: { ...values, serverSeq: nextSeq } })
        .returning({ serverSeq: t.serverSeq });
      if (!saved) throw new Error('Upsert returned no row');
      accepted.push({ table, id: row.id, serverSeq: saved.serverSeq });
    }

    return { accepted, stale, version: await userVersion(tx, userId) };
  });
}

// The user's highest server_seq across the synced tables, in one round trip.
export async function userVersion(tx: Tx | Db, userId: string): Promise<number> {
  const tables = Object.values(SYNC_DB_TABLES) as unknown as SyncDbTable[];
  const [first, ...rest] = tables.map((t) =>
    tx
      .select({ seq: max(t.serverSeq) })
      .from(t)
      .where(eq(t.userId, userId)),
  );
  if (!first) return 0;
  const rows = rest.length > 0 ? await unionAll(first, ...(rest as [typeof first])) : await first;
  return Math.max(0, ...rows.map((r) => r.seq ?? 0));
}
