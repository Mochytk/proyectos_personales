import { describe, expect, it } from 'vitest';
import { addDays } from '../dates/calendar';
import { parseLocalDate as d, type LocalDate } from '../dates/local-date';
import type { CheckInStatus } from '../schemas/habits';
import { effectiveQuota, weeklyProgress, weeklyStreak } from './weekly';

const CURRENT_WEEK = d('2026-10-19');
const NO_OVERRIDES: ReadonlyMap<LocalDate, number> = new Map();

function checkIns(entries: [string, CheckInStatus][]): ReadonlyMap<LocalDate, CheckInStatus> {
  return new Map(entries.map(([date, status]) => [d(date), status]));
}

// Two "done" days (Monday and Tuesday) in each given week: enough for a quota of 2.
function metWeeks(...mondays: string[]): [string, CheckInStatus][] {
  return mondays.flatMap((monday) => [
    [monday, 'done'] as [string, CheckInStatus],
    [addDays(d(monday), 1), 'done'] as [string, CheckInStatus],
  ]);
}

describe('effectiveQuota', () => {
  it('uses the habit quota without an override', () => {
    expect(effectiveQuota({ weeklyQuota: 3 }, CURRENT_WEEK, NO_OVERRIDES)).toBe(3);
  });

  it('uses the override for that week', () => {
    expect(effectiveQuota({ weeklyQuota: 3 }, CURRENT_WEEK, new Map([[CURRENT_WEEK, 1]]))).toBe(1);
  });
});

describe('weeklyProgress', () => {
  const habit = { weeklyQuota: 3 };

  it('counts done days against the quota', () => {
    const result = weeklyProgress({
      habit,
      weekStart: CURRENT_WEEK,
      checkIns: checkIns([
        ['2026-10-19', 'done'],
        ['2026-10-21', 'done'],
      ]),
      overrides: NO_OVERRIDES,
    });
    expect(result).toEqual({ done: 2, quota: 3, met: false });
  });

  it('is met when an override lowers the quota', () => {
    const result = weeklyProgress({
      habit,
      weekStart: CURRENT_WEEK,
      checkIns: checkIns([
        ['2026-10-19', 'done'],
        ['2026-10-21', 'done'],
      ]),
      overrides: new Map([[CURRENT_WEEK, 2]]),
    });
    expect(result.met).toBe(true);
  });

  it('does not count skipped days as done', () => {
    const result = weeklyProgress({
      habit,
      weekStart: CURRENT_WEEK,
      checkIns: checkIns([
        ['2026-10-19', 'done'],
        ['2026-10-20', 'skipped'],
      ]),
      overrides: NO_OVERRIDES,
    });
    expect(result.done).toBe(1);
  });

  it('ignores check-ins outside the week', () => {
    const result = weeklyProgress({
      habit,
      weekStart: CURRENT_WEEK,
      checkIns: checkIns([
        ['2026-10-18', 'done'], // previous Sunday
        ['2026-10-26', 'done'], // next Monday
        ['2026-10-25', 'done'], // this Sunday
      ]),
      overrides: NO_OVERRIDES,
    });
    expect(result.done).toBe(1);
  });

  it('is met with an override of 0', () => {
    const result = weeklyProgress({
      habit,
      weekStart: CURRENT_WEEK,
      checkIns: checkIns([]),
      overrides: new Map([[CURRENT_WEEK, 0]]),
    });
    expect(result).toEqual({ done: 0, quota: 0, met: true });
  });
});

describe('weeklyStreak', () => {
  // startsOn is a Thursday, so the first week starts on Monday 28-09.
  const habit = { weeklyQuota: 2, startsOn: d('2026-10-01') };

  function streak(entries: [string, CheckInStatus][], overrides = NO_OVERRIDES): number {
    return weeklyStreak({
      habit,
      currentWeekStart: CURRENT_WEEK,
      checkIns: checkIns(entries),
      overrides,
    });
  }

  it('counts closed weeks that met the quota while the current one is in progress', () => {
    expect(streak(metWeeks('2026-09-28', '2026-10-05', '2026-10-12'))).toBe(3);
  });

  it('adds the current week once it is met', () => {
    expect(streak(metWeeks('2026-09-28', '2026-10-05', '2026-10-12', '2026-10-19'))).toBe(4);
  });

  it('breaks at a closed week that missed the quota', () => {
    expect(streak(metWeeks('2026-09-28', '2026-10-12'))).toBe(1);
  });

  it('does not break because the first, partial week missed the quota', () => {
    expect(streak(metWeeks('2026-10-05', '2026-10-12'))).toBe(2);
  });

  it('neither adds nor breaks on a paused week (quota 0)', () => {
    const paused = new Map([[d('2026-10-12'), 0]]);
    expect(streak(metWeeks('2026-09-28', '2026-10-05'), paused)).toBe(2);
  });
});
