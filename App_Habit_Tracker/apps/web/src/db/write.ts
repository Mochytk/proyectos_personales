import type { HabitDb, SyncedRows, SyncedTable } from './db';

export function nowIso(): string {
  return new Date().toISOString();
}

// Every local write goes through here: it stamps updatedAt and marks the rows as pending
// in the outbox, in one transaction (ADR 0006). Inside a caller's transaction it joins it.
export async function writeRows<T extends SyncedTable>(
  db: HabitDb,
  table: T,
  rows: SyncedRows[T][],
  updatedAt = nowIso(),
): Promise<SyncedRows[T][]> {
  const stamped = rows.map((row) => ({ ...row, updatedAt }));
  const target = db.table<SyncedRows[T], string>(table);
  await db.transaction('rw', target, db.outbox, async () => {
    await target.bulkPut(stamped);
    await db.outbox.bulkPut(stamped.map((row) => ({ table, id: row.id, queuedAt: updatedAt })));
  });
  return stamped;
}
