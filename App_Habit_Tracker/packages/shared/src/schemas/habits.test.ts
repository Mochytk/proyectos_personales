import { describe, expect, it } from 'vitest';
import {
  anchorSchema,
  checkInSchema,
  habitSchema,
  userSettingsSchema,
  weeklyQuotaOverrideSchema,
  weeklyReviewSchema,
} from './habits';

const NOW = '2026-10-23T15:00:00.000Z';
const sync = {
  id: '0d6c3c2e-6b1f-4a5e-9a3e-1f2b3c4d5e6f',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
};
const ANCHOR_ID = '6b0b2a1e-3c4d-5e6f-8a9b-0c1d2e3f4a5b';

function dailyHabit(overrides: Record<string, unknown> = {}) {
  return {
    ...sync,
    name: 'Leer antes de dormir',
    description: null,
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: '2026-10-23',
    anchorId: ANCHOR_ID,
    color: 'ink',
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  };
}

function checkIn(overrides: Record<string, unknown> = {}) {
  return {
    ...sync,
    habitId: ANCHOR_ID,
    localDate: '2026-10-23',
    status: 'done',
    skipReason: null,
    note: null,
    value: null,
    ...overrides,
  };
}

function issueMessages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((issue) => issue.message) ?? [];
}

describe('habitSchema', () => {
  it('accepts a valid daily habit', () => {
    expect(habitSchema.safeParse(dailyHabit()).success).toBe(true);
  });

  it.each([0, 8, null])('rejects weeklyQuota %s for a weekly quota habit', (weeklyQuota) => {
    const result = habitSchema.safeParse(dailyHabit({ mode: 'weekly_quota', weeklyQuota }));
    expect(result.success).toBe(false);
    expect(issueMessages(result)).toContain('Indica cuántas veces por semana (1 a 7).');
  });

  it('accepts a weekly quota habit with quota 3', () => {
    const result = habitSchema.safeParse(dailyHabit({ mode: 'weekly_quota', weeklyQuota: 3 }));
    expect(result.success).toBe(true);
  });

  it('rejects a weekly quota on a daily habit', () => {
    expect(habitSchema.safeParse(dailyHabit({ weeklyQuota: 3 })).success).toBe(false);
  });

  it.each([[[]], [[1, 1]], [[0]], [[8]]])('rejects weekdays %j', (weekdays) => {
    expect(habitSchema.safeParse(dailyHabit({ weekdays })).success).toBe(false);
  });

  it('trims the name', () => {
    const result = habitSchema.parse(dailyHabit({ name: '  Leer  ' }));
    expect(result.name).toBe('Leer');
  });

  it.each(['   ', 'x'.repeat(61)])('rejects the name %j', (name) => {
    expect(habitSchema.safeParse(dailyHabit({ name })).success).toBe(false);
  });

  it('rejects an impossible startsOn date', () => {
    expect(habitSchema.safeParse(dailyHabit({ startsOn: '2026-02-30' })).success).toBe(false);
  });
});

describe('checkInSchema', () => {
  it('accepts a done check-in', () => {
    expect(checkInSchema.safeParse(checkIn()).success).toBe(true);
  });

  it('accepts a skipped check-in with or without a reason', () => {
    expect(
      checkInSchema.safeParse(checkIn({ status: 'skipped', skipReason: 'certamen' })).success,
    ).toBe(true);
    expect(checkInSchema.safeParse(checkIn({ status: 'skipped' })).success).toBe(true);
  });

  it('rejects a skip reason on a done check-in', () => {
    expect(checkInSchema.safeParse(checkIn({ skipReason: 'certamen' })).success).toBe(false);
  });

  it('rejects a note longer than 280 characters', () => {
    expect(checkInSchema.safeParse(checkIn({ note: 'x'.repeat(281) })).success).toBe(false);
  });
});

describe('userSettingsSchema', () => {
  const settings = { ...sync, timeZone: 'America/Santiago', dayCutoffHour: 4, style: 'cuaderno' };

  it('accepts valid settings', () => {
    expect(userSettingsSchema.safeParse(settings).success).toBe(true);
  });

  it.each([-1, 7, 2.5])('rejects dayCutoffHour %s', (dayCutoffHour) => {
    expect(userSettingsSchema.safeParse({ ...settings, dayCutoffHour }).success).toBe(false);
  });

  it('rejects an unknown time zone', () => {
    expect(userSettingsSchema.safeParse({ ...settings, timeZone: 'Mars/Olympus' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown style', () => {
    expect(userSettingsSchema.safeParse({ ...settings, style: 'neon' }).success).toBe(false);
  });
});

describe('anchors, quota overrides and reviews', () => {
  it('rejects an empty anchor name', () => {
    const anchor = { ...sync, name: ' ', sortOrder: 0, archivedAt: null };
    expect(anchorSchema.safeParse(anchor).success).toBe(false);
  });

  it('rejects a quota override whose week does not start on Monday', () => {
    const override = { ...sync, habitId: ANCHOR_ID, weekStart: '2026-10-20', quota: 2 };
    expect(weeklyQuotaOverrideSchema.safeParse(override).success).toBe(false);
  });

  it('accepts a quota override of 0 on a Monday', () => {
    const override = { ...sync, habitId: ANCHOR_ID, weekStart: '2026-10-19', quota: 0 };
    expect(weeklyQuotaOverrideSchema.safeParse(override).success).toBe(true);
  });

  it('accepts a weekly review with a reflection', () => {
    const review = {
      ...sync,
      weekStart: '2026-10-19',
      reflection: 'Semana de certámenes.',
      completedAt: NOW,
    };
    expect(weeklyReviewSchema.safeParse(review).success).toBe(true);
  });
});
