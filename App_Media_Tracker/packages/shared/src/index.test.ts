import { describe, expect, it } from 'vitest';
import { MEDIA_KINDS } from './index';

describe('MEDIA_KINDS', () => {
  it('lists each kind once', () => {
    expect(new Set(MEDIA_KINDS).size).toBe(MEDIA_KINDS.length);
  });
});
