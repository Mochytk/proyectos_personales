import { parseLocalDate } from '@habit-tracker/shared';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInsRepo } from '../db/check-ins-repo';
import type { HabitDb } from '../db/db';
import { habitsRepo } from '../db/habits-repo';
import { renderRoute } from '../test/render';

async function firstAnchorId(db: HabitDb): Promise<string> {
  const anchor = await db.anchors.orderBy('sortOrder').first();
  if (!anchor) throw new Error('missing anchors');
  return anchor.id;
}

describe('HabitForm', () => {
  beforeEach(() => {
    // 12:00 on 23-10-2026 in Santiago. Only Date is faked, so IndexedDB keeps working.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-10-23T15:00:00.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a daily habit that starts today', async () => {
    const { db, user } = await renderRoute('/habitos/nuevo');

    await user.type(await screen.findByLabelText('Nombre'), 'Leer 20 minutos');
    await user.selectOptions(screen.getByLabelText('Ancla'), 'Noche');
    await user.click(screen.getByRole('checkbox', { name: 'Domingo' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(screen.getByTestId('path').textContent).toBe('/habitos');
    });
    const [habit] = await db.habits.toArray();
    const night = await db.anchors.filter((anchor) => anchor.name === 'Noche').first();
    expect(habit).toMatchObject({
      name: 'Leer 20 minutos',
      mode: 'daily',
      weeklyQuota: null,
      weekdays: [1, 2, 3, 4, 5, 6],
      startsOn: '2026-10-23',
      anchorId: night?.id,
      archivedAt: null,
    });
  });

  it('asks for the quota of a weekly habit and saves nothing without it', async () => {
    const { db, user } = await renderRoute('/habitos/nuevo');

    await user.type(await screen.findByLabelText('Nombre'), 'Gimnasio');
    await user.click(screen.getByRole('radio', { name: 'Cuota semanal' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Indica cuántas veces por semana (1 a 7).')).toBeTruthy();
    expect(screen.getByLabelText('Veces por semana').getAttribute('aria-invalid')).toBe('true');
    expect(await db.habits.count()).toBe(0);
  });

  it('moves focus to the first invalid field when saving fails', async () => {
    const { user } = await renderRoute('/habitos/nuevo');

    await user.click(await screen.findByRole('radio', { name: 'Cuota semanal' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe un nombre.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText('Nombre'));
  });

  it('creates a single habit when Guardar is clicked twice in a row', async () => {
    const { db, user } = await renderRoute('/habitos/nuevo');

    await user.type(await screen.findByLabelText('Nombre'), 'Meditar');
    await user.dblClick(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => {
      expect(screen.getByTestId('path').textContent).toBe('/habitos');
    });
    expect(await db.habits.count()).toBe(1);
  });

  it('warns that the streak is recalculated before changing the days of a habit with check-ins', async () => {
    const { db, user } = await renderRoute('/habitos');
    const habit = await habitsRepo(db).create({
      name: 'Correr',
      description: null,
      mode: 'daily',
      weeklyQuota: null,
      weekdays: [1, 3, 5],
      startsOn: parseLocalDate('2026-10-19'),
      anchorId: await firstAnchorId(db),
      color: 'default',
      icon: null,
    });
    await checkInsRepo(db).markDone(habit.id, parseLocalDate('2026-10-21'));

    await user.click(await screen.findByRole('link', { name: 'Editar Correr' }));
    const warning = 'Si cambias los días, la racha se recalcula con los días nuevos.';
    await screen.findByLabelText('Nombre');
    expect(screen.queryByText(warning)).toBeNull();

    await user.click(screen.getByRole('checkbox', { name: 'Martes' }));
    expect(screen.getByText(warning)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(async () => {
      expect((await db.habits.get(habit.id))?.weekdays).toEqual([1, 2, 3, 5]);
    });
  });
});
