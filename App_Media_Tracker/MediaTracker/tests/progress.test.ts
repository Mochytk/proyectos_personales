import { describe, expect, it } from 'vitest';
import { clampProgress, usesCounter } from '../store/progress';

describe('usesCounter', () => {
  it('uses a counter for pages and for long lists, a checklist otherwise', () => {
    expect(usesCounter('pages', 12)).toBe(true);
    expect(usesCounter('episodes', 62)).toBe(true);
    expect(usesCounter('episodes', 12)).toBe(false);
    expect(usesCounter('levels', 40)).toBe(false);
    expect(usesCounter(undefined, 41)).toBe(true);
  });
});

describe('clampProgress', () => {
  it('moves by the delta within 0 and the total', () => {
    expect(clampProgress(10, 10, 476)).toBe(20);
    expect(clampProgress(5, -10, 476)).toBe(0);
    expect(clampProgress(470, 10, 476)).toBe(476);
  });

  it('treats typed garbage as zero and rounds decimals', () => {
    expect(clampProgress(NaN, 0, 100)).toBe(0);
    expect(clampProgress(NaN, 5, 100)).toBe(5);
    expect(clampProgress(2.6, 0, 100)).toBe(3);
  });
});
