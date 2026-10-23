import {
  DEFAULT_DAY_CUTOFF_HOUR,
  DEFAULT_STYLE,
  DEFAULT_TIME_ZONE,
  seedId,
} from '@habit-tracker/shared';
import { describe, expect, it } from 'vitest';
import { openTestDb } from '../test/db';
import { DEFAULT_ANCHORS, ensureDefaults, SEED_TIMESTAMP, settingsId } from './defaults';

describe('ensureDefaults', () => {
  it('creates the settings and the 7 default anchors only once', async () => {
    const db = await openTestDb();

    await ensureDefaults(db);
    await ensureDefaults(db);

    const anchors = await db.anchors.orderBy('sortOrder').toArray();
    expect(anchors.map((anchor) => anchor.name)).toEqual([
      'Al despertar',
      'Mañana',
      'Después de almorzar',
      'Tarde',
      'Noche',
      'Antes de dormir',
      'Después de entrenar',
    ]);
    expect(anchors[0]?.id).toBe(await seedId('anchor', DEFAULT_ANCHORS[0].slug));
    expect(await db.userSettings.get(await settingsId())).toMatchObject({
      timeZone: DEFAULT_TIME_ZONE,
      dayCutoffHour: DEFAULT_DAY_CUTOFF_HOUR,
      style: DEFAULT_STYLE,
    });
    expect(await db.outbox.count()).toBe(8);
  });

  it('dates the defaults so that any real edit wins a sync conflict', async () => {
    const db = await openTestDb();
    await ensureDefaults(db);

    const anchors = await db.anchors.toArray();
    expect(
      anchors.every((a) => a.createdAt === SEED_TIMESTAMP && a.updatedAt === SEED_TIMESTAMP),
    ).toBe(true);
  });

  it('leaves renamed and deleted default anchors alone', async () => {
    const db = await openTestDb();
    await ensureDefaults(db);
    const [first, second] = await db.anchors.orderBy('sortOrder').toArray();
    if (!first || !second) throw new Error('missing anchors');
    await db.anchors.put({ ...first, name: 'Apenas me levanto' });
    await db.anchors.put({ ...second, deletedAt: '2026-10-23T15:00:00.000Z' });

    await ensureDefaults(db);

    expect((await db.anchors.get(first.id))?.name).toBe('Apenas me levanto');
    expect((await db.anchors.get(second.id))?.deletedAt).toBe('2026-10-23T15:00:00.000Z');
  });
});
