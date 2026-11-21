import { describe, expect, it } from 'vitest';
import { clampUpdatedAt, wins } from './conflict';

const at = (iso: string) => ({ updatedAt: iso });

describe('wins', () => {
  it('lets the newer edit win and the older one lose', () => {
    expect(wins(at('2026-11-04T10:00:01.000Z'), at('2026-11-04T10:00:00.000Z'))).toBe(true);
    expect(wins(at('2026-11-04T09:59:59.000Z'), at('2026-11-04T10:00:00.000Z'))).toBe(false);
  });

  it('gives a tie to the incoming row, which arrived last', () => {
    expect(wins(at('2026-11-04T10:00:00.000Z'), at('2026-11-04T10:00:00.000Z'))).toBe(true);
  });

  it('compares instants, not strings', () => {
    expect(wins(at('2026-11-04T07:00:00.000-03:00'), at('2026-11-04T10:00:00.000Z'))).toBe(true);
    expect(wins(at('2026-11-04T10:00:00Z'), at('2026-11-04T10:00:00.500Z'))).toBe(false);
  });

  it('lets a row win when there is none yet', () => {
    expect(wins(at('2000-01-01T00:00:00.000Z'), undefined)).toBe(true);
  });
});

describe('clampUpdatedAt', () => {
  const now = new Date('2026-11-04T10:00:00.000Z');

  it('brings a clock running ahead back to 5 minutes from now', () => {
    expect(clampUpdatedAt('2100-01-01T00:00:00.000Z', now)).toBe('2026-11-04T10:05:00.000Z');
  });

  it('leaves past and near-future times untouched', () => {
    expect(clampUpdatedAt('2026-11-04T09:00:00.000Z', now)).toBe('2026-11-04T09:00:00.000Z');
    expect(clampUpdatedAt('2026-11-04T10:04:59.000Z', now)).toBe('2026-11-04T10:04:59.000Z');
  });
});
