import { checkInId, parseLocalDate } from '@habit-tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb } from '../test/db';
import { checkInsRepo } from './check-ins-repo';

const NOW = '2026-10-23T15:00:00.000Z';
const DAY = parseLocalDate('2026-10-23');

describe('checkInsRepo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marking done twice leaves one row and one outbox entry', async () => {
    const db = await openTestDb();
    const habitId = crypto.randomUUID();
    const repo = checkInsRepo(db);

    await repo.markDone(habitId, DAY);
    await repo.markDone(habitId, DAY);

    const rows = await db.checkIns.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: await checkInId(habitId, DAY),
      habitId,
      localDate: DAY,
      status: 'done',
      skipReason: null,
      deletedAt: null,
    });
    expect(await db.outbox.count()).toBe(1);
  });

  it('clearing is a soft delete that gets queued', async () => {
    const db = await openTestDb();
    const habitId = crypto.randomUUID();
    const repo = checkInsRepo(db);
    await repo.markDone(habitId, DAY);
    await db.outbox.clear();

    vi.setSystemTime('2026-10-23T15:01:00.000Z');
    await repo.clear(habitId, DAY);

    const row = await db.checkIns.get(await checkInId(habitId, DAY));
    expect(row?.deletedAt).toBe('2026-10-23T15:01:00.000Z');
    expect(await db.outbox.count()).toBe(1);
  });

  it('marking done after clearing brings the same row back', async () => {
    const db = await openTestDb();
    const habitId = crypto.randomUUID();
    const repo = checkInsRepo(db);
    await repo.markDone(habitId, DAY);
    await repo.clear(habitId, DAY);

    await repo.markDone(habitId, DAY);

    const rows = await db.checkIns.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).toBeNull();
    expect(rows[0]?.createdAt).toBe(NOW);
  });

  it('skips a day with a reason and a note', async () => {
    const db = await openTestDb();
    const habitId = crypto.randomUUID();

    await checkInsRepo(db).skip(habitId, DAY, 'certamen', 'Certamen de cálculo');

    expect(await db.checkIns.get(await checkInId(habitId, DAY))).toMatchObject({
      status: 'skipped',
      skipReason: 'certamen',
      note: 'Certamen de cálculo',
    });
  });

  it('pausing the day only skips habits without a record', async () => {
    const db = await openTestDb();
    const done = crypto.randomUUID();
    const cleared = crypto.randomUUID();
    const pending = crypto.randomUUID();
    const repo = checkInsRepo(db);
    await repo.markDone(done, DAY);
    await repo.markDone(cleared, DAY);
    await repo.clear(cleared, DAY);

    await repo.pauseDay(DAY, 'enfermedad', [done, cleared, pending]);

    const byHabit = new Map((await db.checkIns.toArray()).map((row) => [row.habitId, row]));
    expect(byHabit.get(done)).toMatchObject({ status: 'done', skipReason: null });
    expect(byHabit.get(cleared)).toMatchObject({
      status: 'skipped',
      skipReason: 'enfermedad',
      deletedAt: null,
    });
    expect(byHabit.get(pending)).toMatchObject({ status: 'skipped', skipReason: 'enfermedad' });
    expect(await db.outbox.count()).toBe(3);
  });
});
