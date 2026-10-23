import { describe, expect, it } from 'vitest';
import { parseLocalDate, toLocalDate } from './local-date';

const TZ = 'America/Santiago';

describe('toLocalDate', () => {
  it.each([
    ['2026-10-23T15:00:00Z', '2026-10-23'], // 12:00 local
    ['2026-10-24T06:30:00Z', '2026-10-23'], // 03:30 local, before the cutoff
    ['2026-10-24T07:30:00Z', '2026-10-24'], // 04:30 local
    ['2026-04-05T07:30:00Z', '2026-04-04'], // 03:30, already UTC-4 (DST ended)
    ['2026-04-05T08:30:00Z', '2026-04-05'], // 04:30, UTC-4
    ['2026-09-06T06:30:00Z', '2026-09-05'], // 03:30, already UTC-3 (DST started)
    ['2026-09-06T07:30:00Z', '2026-09-06'], // 04:30, UTC-3
    ['2027-01-01T06:59:00Z', '2026-12-31'], // 03:59 on 1 January
    ['2027-01-01T07:01:00Z', '2027-01-01'], // 04:01
  ])('toLocalDate(%s) is %s with cutoff 4', (iso, expected) => {
    expect(toLocalDate(new Date(iso), TZ, 4)).toBe(expected);
  });

  it('uses midnight when cutoff is 0', () => {
    expect(toLocalDate(new Date('2026-10-24T03:30:00Z'), TZ, 0)).toBe('2026-10-24');
  });

  it('rejects a cutoff outside 0-6', () => {
    expect(() => toLocalDate(new Date(), TZ, 7)).toThrow(RangeError);
  });
});

describe('parseLocalDate', () => {
  it('accepts a valid date', () => {
    expect(parseLocalDate('2026-10-23')).toBe('2026-10-23');
  });

  it('rejects impossible dates', () => {
    expect(() => parseLocalDate('2026-02-30')).toThrow(RangeError);
  });

  it('rejects other formats', () => {
    expect(() => parseLocalDate('23-10-2026')).toThrow(RangeError);
  });
});
