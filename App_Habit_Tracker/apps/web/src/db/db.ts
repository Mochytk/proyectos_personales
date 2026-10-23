import type {
  Anchor,
  CheckIn,
  Habit,
  UserSettings,
  WeeklyQuotaOverride,
  WeeklyReview,
} from '@habit-tracker/shared';
import { Dexie, type EntityTable, type Table } from 'dexie';

export const DB_NAME = 'constancia';

// Tables that sync with the server (ADR 0006), by their Dexie name.
export interface SyncedRows {
  anchors: Anchor;
  habits: Habit;
  checkIns: CheckIn;
  weeklyQuotaOverrides: WeeklyQuotaOverride;
  weeklyReviews: WeeklyReview;
  userSettings: UserSettings;
}
export type SyncedTable = keyof SyncedRows;

// A row waiting to be pushed. One entry per row, however many times it was edited.
export interface OutboxEntry {
  table: SyncedTable;
  id: string;
  queuedAt: string;
}

// Filled in by the sync engine (phase 2).
export interface SyncStateRow {
  id: 'sync';
  cursor: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

export class HabitDb extends Dexie {
  anchors!: EntityTable<Anchor, 'id'>;
  habits!: EntityTable<Habit, 'id'>;
  checkIns!: EntityTable<CheckIn, 'id'>;
  weeklyQuotaOverrides!: EntityTable<WeeklyQuotaOverride, 'id'>;
  weeklyReviews!: EntityTable<WeeklyReview, 'id'>;
  userSettings!: EntityTable<UserSettings, 'id'>;
  outbox!: Table<OutboxEntry, [SyncedTable, string]>;
  syncState!: EntityTable<SyncStateRow, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      anchors: 'id, sortOrder',
      habits: 'id, anchorId, archivedAt',
      checkIns: 'id, habitId, localDate, [habitId+localDate]',
      weeklyQuotaOverrides: 'id, [habitId+weekStart]',
      weeklyReviews: 'id, weekStart',
      userSettings: 'id',
      outbox: '[table+id], queuedAt',
      syncState: 'id',
    });
  }
}

// IndexedDB can be missing or refuse to open (private mode, storage blocked, disk full).
export class StorageUnavailableError extends Error {
  constructor(options?: ErrorOptions) {
    super('Local storage is unavailable', options);
    this.name = 'StorageUnavailableError';
  }
}

export async function openDb(name = DB_NAME): Promise<HabitDb> {
  if (typeof globalThis.indexedDB === 'undefined') throw new StorageUnavailableError();
  const db = new HabitDb(name);
  try {
    await db.open();
  } catch (error) {
    throw new StorageUnavailableError({ cause: error });
  }
  return db;
}
