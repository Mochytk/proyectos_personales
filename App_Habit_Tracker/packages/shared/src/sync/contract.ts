import { z } from 'zod';
import {
  anchorSchema,
  checkInSchema,
  habitSchema,
  userSettingsSchema,
  weeklyQuotaOverrideSchema,
  weeklyReviewSchema,
} from '../schemas/habits';

// The wire format of push and pull (ADR 0006). Rows travel as full snapshots, validated
// with the same schemas the app uses locally; user_id never travels, the session sets it.

// Parents first, so a page applied in this order never holds a child before its parent.
export const SYNC_TABLES = [
  'userSettings',
  'anchors',
  'habits',
  'checkIns',
  'weeklyQuotaOverrides',
  'weeklyReviews',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export const SYNC_ROW_SCHEMAS = {
  userSettings: userSettingsSchema,
  anchors: anchorSchema,
  habits: habitSchema,
  checkIns: checkInSchema,
  weeklyQuotaOverrides: weeklyQuotaOverrideSchema,
  weeklyReviews: weeklyReviewSchema,
} as const satisfies Record<SyncTable, z.ZodType>;

export const PUSH_BATCH_MAX = 200;
export const PULL_PAGE_SIZE = 500;

function syncRowSchema<T extends SyncTable>(table: T) {
  return z.object({ table: z.literal(table), row: SYNC_ROW_SCHEMAS[table] });
}

const syncRowSchemas = [
  syncRowSchema('userSettings'),
  syncRowSchema('anchors'),
  syncRowSchema('habits'),
  syncRowSchema('checkIns'),
  syncRowSchema('weeklyQuotaOverrides'),
  syncRowSchema('weeklyReviews'),
] as const;

export const syncRowSchemaUnion = z.discriminatedUnion('table', syncRowSchemas);
export type SyncRow = z.infer<typeof syncRowSchemaUnion>;

export const pushRequestSchema = z.object({
  rows: z.array(syncRowSchemaUnion).min(1).max(PUSH_BATCH_MAX),
});
export type PushRequest = z.infer<typeof pushRequestSchema>;

const serverSeqSchema = z.number().int().nonnegative();
const syncTableSchema = z.enum(SYNC_TABLES);

export const pushResponseSchema = z.object({
  accepted: z.array(z.object({ table: syncTableSchema, id: z.uuid(), serverSeq: serverSeqSchema })),
  // Rows an edit with a later updatedAt already beat; the client keeps the server's copy.
  stale: z.array(z.object({ table: syncTableSchema, id: z.uuid() })),
  // The user's highest server_seq after this push.
  version: serverSeqSchema,
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

function withSeq<T extends SyncTable>(table: T) {
  return syncRowSchema(table).extend({ serverSeq: serverSeqSchema });
}

export const pullRowSchema = z.discriminatedUnion('table', [
  withSeq('userSettings'),
  withSeq('anchors'),
  withSeq('habits'),
  withSeq('checkIns'),
  withSeq('weeklyQuotaOverrides'),
  withSeq('weeklyReviews'),
]);
export type PullRow = z.infer<typeof pullRowSchema>;

export const pullResponseSchema = z.object({
  rows: z.array(pullRowSchema).max(PULL_PAGE_SIZE),
  cursor: serverSeqSchema,
  hasMore: z.boolean(),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;
