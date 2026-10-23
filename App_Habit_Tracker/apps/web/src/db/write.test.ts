import { describe, expect, it } from 'vitest';
import type { Anchor } from '@habit-tracker/shared';
import { openTestDb } from '../test/db';
import { writeRows } from './write';

function anchor(overrides: Partial<Anchor> = {}): Anchor {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    deletedAt: null,
    name: 'Mañana',
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  };
}

describe('writeRows', () => {
  it('stamps updatedAt and queues every row in the outbox', async () => {
    const db = await openTestDb();
    const rows = [anchor(), anchor({ name: 'Noche', sortOrder: 1 })];

    await writeRows(db, 'anchors', rows, '2026-10-23T15:00:00.000Z');

    const stored = await db.anchors.toArray();
    expect(stored.map((row) => row.updatedAt)).toEqual([
      '2026-10-23T15:00:00.000Z',
      '2026-10-23T15:00:00.000Z',
    ]);
    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(2);
    expect(outbox.every((entry) => entry.table === 'anchors')).toBe(true);
    expect(outbox.map((entry) => entry.id).sort()).toEqual(rows.map((row) => row.id).sort());
  });

  it('keeps one outbox entry per row, however many times it is written', async () => {
    const db = await openTestDb();
    const row = anchor();

    await writeRows(db, 'anchors', [row], '2026-10-23T15:00:00.000Z');
    await writeRows(db, 'anchors', [{ ...row, name: 'Al despertar' }], '2026-10-23T15:05:00.000Z');

    const outbox = await db.outbox.toArray();
    expect(outbox).toEqual([
      { table: 'anchors', id: row.id, queuedAt: '2026-10-23T15:05:00.000Z' },
    ]);
  });

  it('writes nothing, not even to the outbox, when the surrounding transaction fails', async () => {
    const db = await openTestDb();

    await expect(
      db.transaction('rw', db.anchors, db.outbox, async () => {
        await writeRows(db, 'anchors', [anchor()]);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(await db.anchors.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});
