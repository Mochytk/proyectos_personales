import { describe, expect, it } from 'vitest';
import { parseLocalDate as d } from './dates/local-date';
import {
  APP_ID_NAMESPACE,
  checkInId,
  quotaOverrideId,
  seedId,
  uuidV5,
  weeklyReviewId,
} from './ids';

const DNS_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

describe('uuidV5', () => {
  it('matches the known vector for python.org in the DNS namespace', async () => {
    await expect(uuidV5('python.org', DNS_NAMESPACE)).resolves.toBe(
      '886313e1-3b8a-5372-9b90-0c9aee199e5d',
    );
  });

  it('marks the result as version 5 with the RFC variant', async () => {
    const id = await uuidV5('anything', APP_ID_NAMESPACE);
    expect(id[14]).toBe('5');
    expect('89ab').toContain(id[19]);
  });

  it('rejects a malformed namespace', async () => {
    await expect(uuidV5('x', 'not-a-uuid')).rejects.toThrow(RangeError);
  });
});

describe('checkInId', () => {
  it('is the same for the same habit and day, on any device', async () => {
    const first = await checkInId('h1', d('2026-10-23'));
    const second = await checkInId('h1', d('2026-10-23'));
    expect(first).toBe(second);
  });

  it('differs for another day', async () => {
    const friday = await checkInId('h1', d('2026-10-23'));
    const saturday = await checkInId('h1', d('2026-10-24'));
    expect(friday).not.toBe(saturday);
  });

  it('hashes the documented name format', async () => {
    await expect(checkInId('h1', d('2026-10-23'))).resolves.toBe(
      await uuidV5('check_in:h1:2026-10-23', APP_ID_NAMESPACE),
    );
  });
});

describe('other deterministic ids', () => {
  it('quotaOverrideId hashes quota:{habitId}:{weekStart}', async () => {
    await expect(quotaOverrideId('h1', d('2026-10-19'))).resolves.toBe(
      await uuidV5('quota:h1:2026-10-19', APP_ID_NAMESPACE),
    );
  });

  it('weeklyReviewId hashes review:{weekStart}', async () => {
    await expect(weeklyReviewId(d('2026-10-19'))).resolves.toBe(
      await uuidV5('review:2026-10-19', APP_ID_NAMESPACE),
    );
  });

  it('seedId hashes {kind}:{slug}', async () => {
    await expect(seedId('anchor', 'wake_up')).resolves.toBe(
      await uuidV5('anchor:wake_up', APP_ID_NAMESPACE),
    );
  });
});
