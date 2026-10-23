import { describe, expect, it } from 'vitest';
import { formatDisplayDate, formatShortDay } from './format';
import { parseLocalDate as d } from './local-date';

describe('formatDisplayDate', () => {
  it('writes DD-MM-AAAA', () => {
    expect(formatDisplayDate(d('2026-10-23'))).toBe('23-10-2026');
  });

  it('keeps leading zeros', () => {
    expect(formatDisplayDate(d('2027-01-05'))).toBe('05-01-2027');
  });
});

describe('formatShortDay', () => {
  it.each([
    ['2026-10-19', 'lun 19-10'],
    ['2026-10-21', 'mié 21-10'],
    ['2026-10-23', 'vie 23-10'],
    ['2026-10-24', 'sáb 24-10'],
    ['2026-10-25', 'dom 25-10'],
  ])('formatShortDay(%s) is %s', (date, expected) => {
    expect(formatShortDay(d(date))).toBe(expected);
  });
});
