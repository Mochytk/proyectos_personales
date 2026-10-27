import { describe, expect, it } from 'vitest';
import { parseLocalDate, type LocalDate } from '../dates/local-date';
import type { CheckInStatus, Habit } from '../schemas/habits';
import { weekSummary } from './week-summary';

const WEEK = parseLocalDate('2026-10-19'); // Monday

type SummaryHabit = Parameters<typeof weekSummary>[0]['habits'][number];

function habit(overrides: Partial<Habit> = {}): SummaryHabit {
  return {
    id: 'daily',
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: parseLocalDate('2026-09-01'),
    archivedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

function days(entries: [string, CheckInStatus][]): Map<LocalDate, CheckInStatus> {
  return new Map(entries.map(([date, status]) => [parseLocalDate(date), status]));
}

describe('weekSummary', () => {
  it('summarises a closed week of a daily and a weekly quota habit', () => {
    const daily = habit({ id: 'daily', weekdays: [1, 3, 5] });
    const quota = habit({ id: 'quota', mode: 'weekly_quota', weeklyQuota: 3 });
    const checkIns = new Map([
      [
        'daily',
        days([
          ['2026-10-19', 'done'],
          ['2026-10-21', 'skipped'],
          ['2026-10-12', 'done'],
          ['2026-10-14', 'done'],
          ['2026-10-16', 'done'],
        ]),
      ],
      [
        'quota',
        days([
          ['2026-10-20', 'done'],
          ['2026-10-22', 'done'],
          ['2026-10-25', 'done'],
          ['2026-10-13', 'done'],
        ]),
      ],
    ]);

    const summary = weekSummary({
      habits: [daily, quota],
      weekStart: WEEK,
      today: parseLocalDate('2026-10-27'),
      checkIns,
      overrides: new Map([['quota', new Map([[parseLocalDate('2026-10-12'), 1]])]]),
    });

    expect(summary).toEqual([
      // Friday 23-10 has no record: missed. The streak ends at the week's last scheduled
      // day: 23-10 missed, so 0.
      { habitId: 'daily', done: 1, skipped: 1, missed: 1, quota: null, met: null, streak: 0 },
      // 3 of 3 this week, and the week before met its override of 1.
      { habitId: 'quota', done: 3, skipped: 0, missed: 0, quota: 3, met: true, streak: 2 },
    ]);
  });

  it('does not count today or later days as missed in the current week', () => {
    const summary = weekSummary({
      habits: [habit()],
      weekStart: WEEK,
      today: parseLocalDate('2026-10-25'), // Sunday
      checkIns: new Map([['daily', days([['2026-10-24', 'done']])]]),
      overrides: new Map(),
    });
    // 19-10 to 23-10 missed; 24-10 done; 25-10 (today) still open.
    expect(summary[0]).toMatchObject({ done: 1, missed: 5, streak: 1 });
  });

  it('breaks the daily streak on a missed last day of a closed week', () => {
    const doneMonToSat = days(
      ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'].map(
        (date): [string, CheckInStatus] => [date, 'done'],
      ),
    );
    const summary = weekSummary({
      habits: [habit()],
      weekStart: WEEK,
      today: parseLocalDate('2026-10-26'), // Monday after
      checkIns: new Map([['daily', doneMonToSat]]),
      overrides: new Map(),
    });
    expect(summary[0]).toMatchObject({ done: 6, missed: 1, streak: 0 });
  });

  it('ignores records after a closed week when counting its streak', () => {
    const summary = weekSummary({
      habits: [habit()],
      weekStart: WEEK,
      today: parseLocalDate('2026-10-27'),
      checkIns: new Map([
        [
          'daily',
          days([
            ['2026-10-25', 'done'],
            ['2026-10-26', 'done'],
          ]),
        ],
      ]),
      overrides: new Map(),
    });
    expect(summary[0]?.streak).toBe(1);
  });

  it('lets an unmet closed week break the weekly streak', () => {
    const quota = habit({ id: 'quota', mode: 'weekly_quota', weeklyQuota: 1 });
    const summary = weekSummary({
      habits: [quota],
      weekStart: WEEK,
      today: parseLocalDate('2026-10-26'),
      checkIns: new Map([['quota', days([['2026-10-13', 'done']])]]),
      overrides: new Map(),
    });
    expect(summary[0]).toMatchObject({ done: 0, met: false, streak: 0 });
  });

  it('leaves out archived and deleted habits, and those that start after the week', () => {
    const summary = weekSummary({
      habits: [
        habit({ id: 'archived', archivedAt: '2026-10-01T00:00:00.000Z' }),
        habit({ id: 'deleted', deletedAt: '2026-10-01T00:00:00.000Z' }),
        habit({ id: 'later', startsOn: parseLocalDate('2026-10-26') }),
        habit({ id: 'midweek', startsOn: parseLocalDate('2026-10-23') }),
      ],
      weekStart: WEEK,
      today: parseLocalDate('2026-10-27'),
      checkIns: new Map(),
      overrides: new Map(),
    });
    expect(summary).toEqual([
      { habitId: 'midweek', done: 0, skipped: 0, missed: 3, quota: null, met: null, streak: 0 },
    ]);
  });
});
