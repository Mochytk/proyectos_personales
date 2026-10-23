import { parseLocalDate } from '@habit-tracker/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openTestDb } from '../test/db';
import { habitsRepo, type NewHabit } from './habits-repo';

const NOW = '2026-10-23T15:00:00.000Z';

function newHabit(overrides: Partial<NewHabit> = {}): NewHabit {
  return {
    name: 'Leer 20 minutos',
    description: null,
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: parseLocalDate('2026-10-23'),
    anchorId: crypto.randomUUID(),
    color: 'azul',
    icon: null,
    ...overrides,
  };
}

describe('habitsRepo', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a habit after the last one and queues it', async () => {
    const db = await openTestDb();
    const repo = habitsRepo(db);

    const first = await repo.create(newHabit());
    const second = await repo.create(newHabit({ name: 'Meditar' }));

    expect(first).toMatchObject({
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      archivedAt: null,
      sortOrder: 0,
    });
    expect(second.sortOrder).toBe(1);
    expect(await db.habits.get(first.id)).toEqual(first);
    expect(await db.outbox.count()).toBe(2);
  });

  it('rejects an invalid habit and writes nothing', async () => {
    const db = await openTestDb();

    await expect(
      habitsRepo(db).create(newHabit({ mode: 'weekly_quota', weeklyQuota: null })),
    ).rejects.toMatchObject({ name: 'ZodError' });

    expect(await db.habits.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });

  it('updates a habit, keeping createdAt', async () => {
    const db = await openTestDb();
    const repo = habitsRepo(db);
    const habit = await repo.create(newHabit());

    vi.setSystemTime('2026-10-24T09:00:00.000Z');
    const updated = await repo.update(habit.id, { name: 'Leer 30 minutos' });

    expect(updated).toMatchObject({
      name: 'Leer 30 minutos',
      createdAt: NOW,
      updatedAt: '2026-10-24T09:00:00.000Z',
    });
    expect(await db.outbox.get(['habits', habit.id])).toMatchObject({
      queuedAt: '2026-10-24T09:00:00.000Z',
    });
  });

  it('archives and reactivates a habit', async () => {
    const db = await openTestDb();
    const repo = habitsRepo(db);
    const habit = await repo.create(newHabit());

    await repo.archive(habit.id);
    expect((await db.habits.get(habit.id))?.archivedAt).toBe(NOW);

    await repo.unarchive(habit.id);
    expect((await db.habits.get(habit.id))?.archivedAt).toBeNull();
  });

  it('fails to update a habit that does not exist', async () => {
    const db = await openTestDb();
    await expect(habitsRepo(db).update(crypto.randomUUID(), { name: 'X' })).rejects.toThrow(
      'Habit not found',
    );
  });
});
