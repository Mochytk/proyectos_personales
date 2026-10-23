import { describe, expect, it } from 'vitest';
import type { IsoWeekday } from '../dates/calendar';
import { parseLocalDate as d, type LocalDate } from '../dates/local-date';
import type { CheckInStatus } from '../schemas/habits';
import { dailyStreak } from './streak';

const EVERY_DAY: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5];
const TODAY = d('2026-10-23'); // Friday

function checkIns(entries: [string, CheckInStatus][]): ReadonlyMap<LocalDate, CheckInStatus> {
  return new Map(entries.map(([date, status]) => [d(date), status]));
}

function streak(
  entries: [string, CheckInStatus][],
  options: { weekdays?: IsoWeekday[]; startsOn?: string } = {},
): number {
  return dailyStreak({
    habit: {
      mode: 'daily',
      weekdays: options.weekdays ?? EVERY_DAY,
      startsOn: d(options.startsOn ?? '2026-10-01'),
    },
    today: TODAY,
    checkIns: checkIns(entries),
  });
}

describe('dailyStreak', () => {
  it('is 0 with no check-ins', () => {
    expect(streak([])).toBe(0);
  });

  it('does not break because today has no check-in yet', () => {
    expect(
      streak([
        ['2026-10-20', 'done'],
        ['2026-10-21', 'done'],
        ['2026-10-22', 'done'],
      ]),
    ).toBe(3);
  });

  it('counts today once it is done', () => {
    expect(
      streak([
        ['2026-10-20', 'done'],
        ['2026-10-21', 'done'],
        ['2026-10-22', 'done'],
        ['2026-10-23', 'done'],
      ]),
    ).toBe(4);
  });

  it('keeps the streak through a skipped day without adding to it', () => {
    expect(
      streak([
        ['2026-10-20', 'done'],
        ['2026-10-21', 'skipped'],
        ['2026-10-22', 'done'],
      ]),
    ).toBe(2);
  });

  it('breaks on a past scheduled day with no check-in', () => {
    expect(
      streak([
        ['2026-10-20', 'done'],
        ['2026-10-22', 'done'],
      ]),
    ).toBe(1);
  });

  it('does not break when today is skipped', () => {
    expect(
      streak([
        ['2026-10-22', 'done'],
        ['2026-10-23', 'skipped'],
      ]),
    ).toBe(1);
  });

  it('is 0 when every day was skipped', () => {
    expect(
      streak([
        ['2026-10-20', 'skipped'],
        ['2026-10-21', 'skipped'],
        ['2026-10-22', 'skipped'],
      ]),
    ).toBe(0);
  });

  it('ignores days the habit is not scheduled on', () => {
    expect(
      streak(
        [
          ['2026-10-16', 'done'], // Friday
          ['2026-10-19', 'done'], // Monday
          ['2026-10-20', 'done'],
          ['2026-10-21', 'done'],
          ['2026-10-22', 'done'],
        ],
        { weekdays: WEEKDAYS },
      ),
    ).toBe(5);
  });

  it('does not look before startsOn', () => {
    expect(
      streak(
        [
          ['2026-10-21', 'done'],
          ['2026-10-22', 'done'],
        ],
        { startsOn: '2026-10-21' },
      ),
    ).toBe(2);
  });
});
