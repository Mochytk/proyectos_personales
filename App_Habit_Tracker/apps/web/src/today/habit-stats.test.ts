import {
  parseLocalDate,
  type Anchor,
  type CheckIn,
  type CheckInStatus,
  type Habit,
  type SkipReason,
} from '@habit-tracker/shared';
import { describe, expect, it } from 'vitest';
import { habitStats } from './habit-stats';
import { buildToday } from './today-model';

const NOW = '2026-10-23T15:00:00.000Z';
const TODAY = parseLocalDate('2026-10-23'); // a Friday
const ANCHOR: Anchor = {
  id: '6b0b2a1e-3c4d-5e6f-8a9b-0c1d2e3f4a5b',
  createdAt: NOW,
  updatedAt: NOW,
  deletedAt: null,
  name: 'Mañana',
  sortOrder: 0,
  archivedAt: null,
};

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: '0d6c3c2e-6b1f-4a5e-9a3e-1f2b3c4d5e6f',
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    name: 'Leer',
    description: null,
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: parseLocalDate('2026-09-01'),
    anchorId: ANCHOR.id,
    color: 'default',
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  };
}

function checkIn(
  of: Habit,
  date: string,
  status: CheckInStatus,
  skipReason: SkipReason | null = null,
): CheckIn {
  return {
    id: crypto.randomUUID(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    habitId: of.id,
    localDate: parseLocalDate(date),
    status,
    skipReason,
    note: null,
    value: null,
  };
}

function statsFor(h: Habit, checkIns: CheckIn[]): string {
  const model = buildToday({ habits: [h], anchors: [ANCHOR], checkIns, overrides: [] }, TODAY);
  const row = model.groups[0]?.rows[0];
  if (!row) throw new Error('habit not shown today');
  return habitStats(row, TODAY);
}

describe('habitStats', () => {
  it('shows the streak of a daily habit', () => {
    const h = habit();
    const days = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
    expect(
      statsFor(
        h,
        days.map((d) => checkIn(h, d, 'done')),
      ),
    ).toBe('Racha: 5 días');
    expect(statsFor(h, [checkIn(h, '2026-10-23', 'done')])).toBe('Racha: 1 día');
  });

  it('says nothing for a daily habit with no streak yet', () => {
    expect(statsFor(habit(), [])).toBe('');
  });

  it('shows a skipped day with its reason, and the streak it keeps', () => {
    const h = habit();
    const checkIns = [
      checkIn(h, '2026-10-21', 'done'),
      checkIn(h, '2026-10-22', 'done'),
      checkIn(h, '2026-10-23', 'skipped', 'certamen'),
    ];
    expect(statsFor(h, checkIns)).toBe('Saltado: certamen · Racha: 2 días');
  });

  it('shows progress, then "Cumplido esta semana" and the weekly streak, for a quota', () => {
    const h = habit({ mode: 'weekly_quota', weeklyQuota: 2 });
    expect(statsFor(h, [checkIn(h, '2026-10-20', 'done')])).toBe('1 de 2 esta semana');

    const met = [
      checkIn(h, '2026-10-13', 'done'),
      checkIn(h, '2026-10-15', 'done'),
      checkIn(h, '2026-10-20', 'done'),
      checkIn(h, '2026-10-22', 'done'),
    ];
    expect(statsFor(h, met)).toBe('Cumplido esta semana · Racha: 2 semanas');
  });
});
