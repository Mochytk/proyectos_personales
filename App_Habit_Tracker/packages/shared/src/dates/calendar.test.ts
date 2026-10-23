import { describe, expect, it } from 'vitest';
import { addDays, diffDays, isoWeekday, weekStart } from './calendar';
import { parseLocalDate as d } from './local-date';

describe('addDays', () => {
  it.each([
    ['2026-10-31', 1, '2026-11-01'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2026-10-23', 0, '2026-10-23'],
  ] as const)('addDays(%s, %i) is %s', (date, days, expected) => {
    expect(addDays(d(date), days)).toBe(expected);
  });
});

describe('diffDays', () => {
  it('counts whole days between two dates', () => {
    expect(diffDays(d('2026-10-19'), d('2026-10-26'))).toBe(7);
  });

  it('is negative when the second date is earlier', () => {
    expect(diffDays(d('2026-10-26'), d('2026-10-19'))).toBe(-7);
  });

  it('is not affected by the April DST change in Santiago', () => {
    expect(diffDays(d('2026-04-04'), d('2026-04-06'))).toBe(2);
  });
});

describe('isoWeekday', () => {
  it('returns 5 for a Friday', () => {
    expect(isoWeekday(d('2026-10-23'))).toBe(5);
  });

  it('returns 7 for a Sunday', () => {
    expect(isoWeekday(d('2026-10-25'))).toBe(7);
  });

  it('returns 1 for a Monday', () => {
    expect(isoWeekday(d('2026-10-19'))).toBe(1);
  });
});

describe('weekStart', () => {
  it.each([
    ['2026-10-23', '2026-10-19'],
    ['2026-10-19', '2026-10-19'],
    ['2026-10-25', '2026-10-19'],
    ['2027-01-01', '2026-12-28'],
  ])('weekStart(%s) is %s', (date, expected) => {
    expect(weekStart(d(date))).toBe(expected);
  });
});
