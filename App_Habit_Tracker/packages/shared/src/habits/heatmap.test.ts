import { describe, expect, it } from 'vitest';
import { parseLocalDate, type LocalDate } from '../dates/local-date';
import type { CheckInStatus, Habit } from '../schemas/habits';
import { buildHeatmap } from './heatmap';

const TODAY = parseLocalDate('2026-10-23'); // a Friday

function habit(overrides: Partial<Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>> = {}) {
  return {
    mode: 'daily' as const,
    weekdays: [1, 2, 3, 4, 5, 6, 7] as Habit['weekdays'],
    startsOn: parseLocalDate('2026-01-01'),
    ...overrides,
  };
}

function statuses(entries: [string, CheckInStatus][]): Map<LocalDate, CheckInStatus> {
  return new Map(entries.map(([date, status]) => [parseLocalDate(date), status]));
}

describe('buildHeatmap', () => {
  it('returns 90 days, oldest first, ending today', () => {
    const cells = buildHeatmap({ habit: habit(), today: TODAY, checkIns: new Map() });
    expect(cells).toHaveLength(90);
    expect(cells[0]?.date).toBe('2026-07-26');
    expect(cells.at(-1)?.date).toBe('2026-10-23');
  });

  it('takes another length', () => {
    expect(
      buildHeatmap({ habit: habit(), today: TODAY, checkIns: new Map(), days: 7 }),
    ).toHaveLength(7);
  });

  it('leaves today without a record as pending, not missed', () => {
    const cells = buildHeatmap({ habit: habit(), today: TODAY, checkIns: new Map(), days: 2 });
    expect(cells.map((cell) => cell.state)).toEqual(['missed', 'today_pending']);
  });

  it('marks done and skipped days', () => {
    const checkIns = statuses([
      ['2026-10-21', 'done'],
      ['2026-10-22', 'skipped'],
      ['2026-10-23', 'done'],
    ]);
    const cells = buildHeatmap({ habit: habit(), today: TODAY, checkIns, days: 3 });
    expect(cells.map((cell) => cell.state)).toEqual(['done', 'skipped', 'done']);
  });

  it('marks the days before startsOn', () => {
    const cells = buildHeatmap({
      habit: habit({ startsOn: parseLocalDate('2026-10-22') }),
      today: TODAY,
      checkIns: new Map(),
      days: 3,
    });
    expect(cells.map((cell) => cell.state)).toEqual(['before_start', 'missed', 'today_pending']);
  });

  it('leaves the weekend of a Monday-to-Friday habit as not scheduled', () => {
    const cells = buildHeatmap({
      habit: habit({ weekdays: [1, 2, 3, 4, 5] }),
      today: parseLocalDate('2026-10-26'), // Monday
      checkIns: new Map(),
      days: 3,
    });
    expect(cells.map((cell) => cell.state)).toEqual([
      'not_scheduled',
      'not_scheduled',
      'today_pending',
    ]);
  });

  it('never counts an empty day of a weekly quota habit as missed', () => {
    const cells = buildHeatmap({
      habit: habit({ mode: 'weekly_quota' }),
      today: TODAY,
      checkIns: statuses([['2026-10-21', 'done']]),
      days: 3,
    });
    expect(cells.map((cell) => cell.state)).toEqual(['done', 'not_scheduled', 'today_pending']);
  });
});
