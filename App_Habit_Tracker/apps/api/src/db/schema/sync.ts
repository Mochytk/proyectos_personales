import {
  type AnyPgColumn,
  bigint,
  date,
  doublePrecision,
  index,
  integer,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// The synced tables (docs/modelo-de-datos.md, ADR 0006). Fields mirror the shared Zod
// schemas in packages/shared, plus user_id and server_seq, which exist only here. No
// foreign keys between synced tables: rows arrive in any order and are soft-deleted.

// The pull cursor: every accepted write gets the next value.
export const syncSeq = pgSequence('sync_seq');

const timestamps = () => ({
  createdAt: timestamp({ withTimezone: true }).notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
  deletedAt: timestamp({ withTimezone: true }),
});

function synced<T extends Record<string, unknown>>(columns: T) {
  return {
    userId: text().notNull(),
    id: uuid().notNull(),
    ...timestamps(),
    serverSeq: bigint({ mode: 'number' }).notNull(),
    ...columns,
  };
}

// Every synced table is keyed by (user_id, id) and pulled by (user_id, server_seq).
function keys(name: string) {
  return (table: { userId: AnyPgColumn; id: AnyPgColumn; serverSeq: AnyPgColumn }) => [
    primaryKey({ columns: [table.userId, table.id] }),
    index(`${name}_user_id_server_seq_idx`).on(table.userId, table.serverSeq),
  ];
}

export const userSettings = pgTable(
  'user_settings',
  synced({
    timeZone: text().notNull(),
    dayCutoffHour: smallint().notNull(),
    style: text().notNull(),
  }),
  keys('user_settings'),
);

export const anchors = pgTable(
  'anchors',
  synced({
    name: text().notNull(),
    sortOrder: integer().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
  }),
  keys('anchors'),
);

export const habits = pgTable(
  'habits',
  synced({
    name: text().notNull(),
    description: text(),
    mode: text().notNull(),
    weeklyQuota: smallint(),
    weekdays: smallint().array().notNull(),
    startsOn: date({ mode: 'string' }).notNull(),
    anchorId: uuid().notNull(),
    color: text().notNull(),
    icon: text(),
    sortOrder: integer().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
  }),
  keys('habits'),
);

export const checkIns = pgTable(
  'check_ins',
  synced({
    habitId: uuid().notNull(),
    localDate: date({ mode: 'string' }).notNull(),
    status: text().notNull(),
    skipReason: text(),
    note: text(),
    value: doublePrecision(),
  }),
  keys('check_ins'),
);

export const weeklyQuotaOverrides = pgTable(
  'weekly_quota_overrides',
  synced({
    habitId: uuid().notNull(),
    weekStart: date({ mode: 'string' }).notNull(),
    quota: smallint().notNull(),
  }),
  keys('weekly_quota_overrides'),
);

export const weeklyReviews = pgTable(
  'weekly_reviews',
  synced({
    weekStart: date({ mode: 'string' }).notNull(),
    reflection: text(),
    completedAt: timestamp({ withTimezone: true }),
  }),
  keys('weekly_reviews'),
);
