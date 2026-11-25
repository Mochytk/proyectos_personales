import { describe, expect, it } from 'vitest';
import { toDbValues } from './tables';

describe('toDbValues', () => {
  it('always takes the user from the session, even if a row carried one', () => {
    // The schemas strip unknown keys today; this guards the server if that ever changes.
    const row = {
      id: '00000000-0000-4000-8000-000000000001',
      createdAt: '2026-01-05T10:00:00.000Z',
      updatedAt: '2026-01-05T10:00:00.000Z',
      deletedAt: null,
      name: 'Al despertar',
      sortOrder: 0,
      archivedAt: null,
      userId: 'someone-else',
    };
    const values = toDbValues('anchors', row, 'session-user');
    expect(values.userId).toBe('session-user');
    expect(values.updatedAt).toEqual(new Date('2026-01-05T10:00:00.000Z'));
  });
});
