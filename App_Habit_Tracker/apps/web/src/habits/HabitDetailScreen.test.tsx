import { parseLocalDate } from '@habit-tracker/shared';
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInsRepo } from '../db/check-ins-repo';
import { addHabit } from '../test/fixtures';
import { renderRoute } from '../test/render';

describe('HabitDetailScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-10-23T15:00:00.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens from the habit list and shows its 90-day history', async () => {
    const { db, user } = await renderRoute('/habitos');
    const habit = await addHabit(db, { name: 'Correr', weekdays: [1, 3, 5] });
    await checkInsRepo(db).markDone(habit.id, parseLocalDate('2026-10-23'));

    await user.click(await screen.findByRole('link', { name: 'Correr' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Correr' })).toBeTruthy();
    expect(screen.getByText('Lun, Mié y Vie')).toBeTruthy();
    const grid = await screen.findByRole('list', { name: 'Últimos 90 días' });
    expect(within(grid).getByLabelText('vie 23-10: hecho')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Editar' }).getAttribute('href')).toBe(
      `/habitos/${habit.id}/editar`,
    );
  });

  it('says so when the habit does not exist', async () => {
    await renderRoute(`/habitos/${crypto.randomUUID()}`);
    expect(await screen.findByText('No encontramos este hábito.')).toBeTruthy();
  });
});
