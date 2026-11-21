import { getTableColumns } from 'drizzle-orm';
import type { SyncRow, SyncTable } from '@habit-tracker/shared';
import {
  anchors,
  checkIns,
  habits,
  userSettings,
  weeklyQuotaOverrides,
  weeklyReviews,
} from '../db/schema';

// Every synced table shares userId, id, serverSeq and the timestamps, so code that only
// touches those can treat them alike; the rest of the columns pass through untouched.
export type SyncDbTable = typeof anchors;

export const SYNC_DB_TABLES = {
  userSettings,
  anchors,
  habits,
  checkIns,
  weeklyQuotaOverrides,
  weeklyReviews,
} as const;

export function dbTable(table: SyncTable): SyncDbTable {
  return SYNC_DB_TABLES[table] as unknown as SyncDbTable;
}

type DbRow = Record<string, unknown>;

function isTimestamp(table: SyncTable, key: string): boolean {
  const columns = getTableColumns(SYNC_DB_TABLES[table]) as Record<string, { columnType: string }>;
  return columns[key]?.columnType === 'PgTimestamp';
}

// Wire row (ISO strings) to column values (Date), with the user from the session.
export function toDbValues(table: SyncTable, row: SyncRow['row'], userId: string): DbRow {
  const values: DbRow = { userId };
  for (const [key, value] of Object.entries(row)) {
    values[key] = isTimestamp(table, key) && typeof value === 'string' ? new Date(value) : value;
  }
  return values;
}

// Column values back to a wire row. user_id never leaves the server.
export function toWireRow(dbRow: DbRow): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dbRow)) {
    if (key === 'userId' || key === 'serverSeq') continue;
    row[key] = value instanceof Date ? value.toISOString() : value;
  }
  return row;
}

// Same content, ignoring server bookkeeping and key order.
export function sameContent(a: DbRow, b: DbRow): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('userId');
  keys.delete('serverSeq');
  for (const key of keys) {
    if (JSON.stringify(a[key] ?? null) !== JSON.stringify(b[key] ?? null)) return false;
  }
  return true;
}
