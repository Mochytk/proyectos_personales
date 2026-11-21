import { PULL_PAGE_SIZE, SYNC_TABLES, type PullResponse } from '@habit-tracker/shared';
import { and, asc, eq, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { dbTable, toWireRow } from './tables';

// The user's rows with server_seq > cursor, soft deletes included, oldest first.
// One read-only snapshot for all six tables: a push that commits halfway through would
// otherwise move the cursor past rows this page never saw.
export async function pull(db: Db, userId: string, cursor: number): Promise<PullResponse> {
  const rows = await db.transaction(
    async (tx) => {
      const found: PullResponse['rows'] = [];
      for (const table of SYNC_TABLES) {
        const t = dbTable(table);
        // Each table's first PULL_PAGE_SIZE + 1 rows are enough to fill the merged page
        // and tell whether more remain.
        const page = await tx
          .select()
          .from(t)
          .where(and(eq(t.userId, userId), gt(t.serverSeq, cursor)))
          .orderBy(asc(t.serverSeq))
          .limit(PULL_PAGE_SIZE + 1);
        for (const row of page) {
          found.push({ table, row: toWireRow(row), serverSeq: row.serverSeq } as never);
        }
      }
      return found;
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );

  rows.sort((a, b) => a.serverSeq - b.serverSeq);
  const page = rows.slice(0, PULL_PAGE_SIZE);
  return {
    rows: page,
    cursor: page.at(-1)?.serverSeq ?? cursor,
    hasMore: rows.length > PULL_PAGE_SIZE,
  };
}
