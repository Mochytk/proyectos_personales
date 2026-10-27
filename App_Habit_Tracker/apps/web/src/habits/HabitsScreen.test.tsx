import { parseLocalDate } from '@habit-tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HabitDb } from '../db/db';
import { habitsRepo, type NewHabit } from '../db/habits-repo';
import { renderRoute } from '../test/render';

async function addHabit(db: HabitDb, overrides: Partial<NewHabit> = {}) {
  const anchor = await db.anchors.orderBy('sortOrder').first();
  if (!anchor) throw new Error('missing anchors');
  return habitsRepo(db).create({
    name: 'Leer',
    description: null,
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: parseLocalDate('2026-10-23'),
    anchorId: anchor.id,
    color: 'default',
    icon: null,
    ...overrides,
  });
}

describe('HabitsScreen', () => {
  it('invites to create the first habit when there are none', async () => {
    await renderRoute('/habitos');
    expect(await screen.findByText('Todavía no tienes hábitos.')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Crear hábito' }).length).toBeGreaterThan(0);
  });

  it('lists habits under their anchor with their schedule', async () => {
    const { db } = await renderRoute('/habitos');
    await addHabit(db, { name: 'Leer' });
    await addHabit(db, { name: 'Gimnasio', mode: 'weekly_quota', weeklyQuota: 3 });
    await addHabit(db, { name: 'Correr', weekdays: [1, 3, 5] });

    const group = await screen.findByRole('region', { name: 'Al despertar' });
    await within(group).findByText('Correr');
    expect(within(group).getByText('Todos los días')).toBeTruthy();
    expect(within(group).getByText('3 veces por semana')).toBeTruthy();
    expect(within(group).getByText('Lun, Mié y Vie')).toBeTruthy();
  });

  it('archives a habit and brings it back', async () => {
    const { db, user } = await renderRoute('/habitos');
    const habit = await addHabit(db, { name: 'Meditar' });

    await user.click(await screen.findByRole('button', { name: 'Archivar Meditar' }));

    const archived = await screen.findByRole('region', { name: 'Archivados' });
    expect(within(archived).getByText('Meditar')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Al despertar' })).toBeNull();
    await waitFor(async () => {
      expect((await db.habits.get(habit.id))?.archivedAt).not.toBeNull();
    });

    await user.click(within(archived).getByRole('button', { name: 'Reactivar Meditar' }));
    await screen.findByRole('region', { name: 'Al despertar' });
    expect(screen.queryByRole('region', { name: 'Archivados' })).toBeNull();
  });
});
