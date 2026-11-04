import { describe, expect, it } from 'vitest';
import { pullResponseSchema, pushRequestSchema, pushResponseSchema, SYNC_TABLES } from './contract';

const NOW = '2026-11-04T10:00:00.000Z';
const ANCHOR = {
  id: '6b0b2a1e-3c4d-5e6f-8a9b-0c1d2e3f4a5b',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  name: 'Al despertar',
  sortOrder: 0,
  archivedAt: null,
};

describe('SYNC_TABLES', () => {
  it('lists the synced tables, parents first', () => {
    expect(SYNC_TABLES).toEqual([
      'userSettings',
      'anchors',
      'habits',
      'checkIns',
      'weeklyQuotaOverrides',
      'weeklyReviews',
    ]);
  });
});

describe('pushRequestSchema', () => {
  it('accepts a batch of rows tagged with their table', () => {
    const parsed = pushRequestSchema.parse({ rows: [{ table: 'anchors', row: ANCHOR }] });
    expect(parsed.rows[0]?.row).toEqual(ANCHOR);
  });

  it('validates each row with its own table schema', () => {
    const result = pushRequestSchema.safeParse({
      rows: [{ table: 'anchors', row: { ...ANCHOR, name: '' } }],
    });
    expect(result.success).toBe(false);
  });

  it('keeps the cross-field rules of a table, such as the weekly quota of a habit', () => {
    const habit = {
      ...ANCHOR,
      name: 'Correr',
      description: null,
      mode: 'weekly_quota',
      weeklyQuota: null,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startsOn: '2026-11-02',
      anchorId: ANCHOR.id,
      color: 'ink',
      icon: null,
    };
    expect(pushRequestSchema.safeParse({ rows: [{ table: 'habits', row: habit }] }).success).toBe(
      false,
    );
    expect(
      pushRequestSchema.safeParse({
        rows: [{ table: 'habits', row: { ...habit, weeklyQuota: 3 } }],
      }).success,
    ).toBe(true);
  });

  it('rejects an empty batch, a batch of 201 rows and an unknown table', () => {
    const rows = (n: number) =>
      Array.from({ length: n }, () => ({ table: 'anchors', row: ANCHOR }));
    expect(pushRequestSchema.safeParse({ rows: [] }).success).toBe(false);
    expect(pushRequestSchema.safeParse({ rows: rows(200) }).success).toBe(true);
    expect(pushRequestSchema.safeParse({ rows: rows(201) }).success).toBe(false);
    expect(pushRequestSchema.safeParse({ rows: [{ table: 'users', row: ANCHOR }] }).success).toBe(
      false,
    );
  });
});

describe('responses', () => {
  it('parses a push response', () => {
    const response = {
      accepted: [{ table: 'anchors', id: ANCHOR.id, serverSeq: 7 }],
      stale: [],
      version: 7,
    };
    expect(pushResponseSchema.parse(response)).toEqual(response);
  });

  it('parses a pull page whose rows carry their server sequence', () => {
    const page = {
      rows: [{ table: 'anchors', row: ANCHOR, serverSeq: 7 }],
      cursor: 7,
      hasMore: false,
    };
    expect(pullResponseSchema.parse(page)).toEqual(page);
    expect(
      pullResponseSchema.safeParse({ ...page, rows: [{ table: 'anchors', row: ANCHOR }] }).success,
    ).toBe(false);
  });
});
