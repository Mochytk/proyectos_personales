import { parseLocalDate } from '@habit-tracker/shared';
import { describe, expect, it } from 'vitest';
import { openTestDb } from '../test/db';
import { AnchorInUseError, anchorsRepo } from './anchors-repo';
import { ensureDefaults } from './defaults';
import type { HabitDb } from './db';
import { habitsRepo } from './habits-repo';

async function names(db: HabitDb): Promise<string[]> {
  const anchors = await db.anchors.orderBy('sortOrder').toArray();
  return anchors.filter((a) => a.archivedAt === null).map((a) => a.name);
}

async function seeded(): Promise<HabitDb> {
  const db = await openTestDb();
  await ensureDefaults(db);
  return db;
}

describe('anchorsRepo', () => {
  it('adds an anchor at the end', async () => {
    const db = await seeded();
    await anchorsRepo(db).create('Al llegar a casa');
    expect((await names(db)).at(-1)).toBe('Al llegar a casa');
  });

  it('moves an anchor up and down, past archived ones', async () => {
    const db = await seeded();
    const repo = anchorsRepo(db);
    const [wakeUp, morning, afterLunch] = await db.anchors.orderBy('sortOrder').toArray();
    if (!wakeUp || !morning || !afterLunch) throw new Error('missing anchors');
    await repo.archive(morning.id);

    await repo.move(afterLunch.id, 'up');
    expect((await names(db)).slice(0, 2)).toEqual(['Después de almorzar', 'Al despertar']);

    await repo.move(afterLunch.id, 'down');
    expect((await names(db)).slice(0, 2)).toEqual(['Al despertar', 'Después de almorzar']);
  });

  it('refuses to archive an anchor that still has active habits', async () => {
    const db = await seeded();
    const anchor = await db.anchors.orderBy('sortOrder').first();
    if (!anchor) throw new Error('missing anchors');
    await habitsRepo(db).create({
      name: 'Tomar agua',
      description: null,
      mode: 'daily',
      weeklyQuota: null,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startsOn: parseLocalDate('2026-10-23'),
      anchorId: anchor.id,
      color: 'default',
      icon: null,
    });

    await expect(anchorsRepo(db).archive(anchor.id)).rejects.toBeInstanceOf(AnchorInUseError);
    expect((await db.anchors.get(anchor.id))?.archivedAt).toBeNull();
  });
});
