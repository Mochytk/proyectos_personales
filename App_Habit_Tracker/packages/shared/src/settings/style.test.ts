import { describe, expect, it } from 'vitest';
import { parseLocalDate as d } from '../dates/local-date';
import { resolveStyle } from './style';

describe('resolveStyle', () => {
  it('returns a fixed style as is', () => {
    expect(resolveStyle('linea', d('2026-10-23'))).toBe('linea');
  });

  it.each([
    ['2026-10-23', 'cuaderno'], // week of 19-10, the reference week
    ['2026-10-26', 'linea'],
    ['2026-11-02', 'disco'],
    ['2026-11-09', 'cuaderno'],
    ['2026-10-12', 'disco'], // the week before the reference
    ['2026-10-25', 'cuaderno'], // Sunday still belongs to the week of 19-10
  ])('rotates weekly: %s is %s', (date, expected) => {
    expect(resolveStyle('rotate', d(date))).toBe(expected);
  });
});
