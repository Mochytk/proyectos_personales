import { checkInId, parseLocalDate, type VisualStyle } from '@habit-tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInsRepo } from '../db/check-ins-repo';
import { addHabit } from '../test/fixtures';
import { renderRoute } from '../test/render';

// 12:00 on Friday 23-10-2026 in Santiago. Only Date is faked, so IndexedDB keeps working.
const NOON = new Date('2026-10-23T15:00:00.000Z');
const TODAY = parseLocalDate('2026-10-23');

const SIGNATURES: Record<VisualStyle, RegExp> = {
  cuaderno: /^Semana:/,
  linea: /^Recorrido de hoy:/,
  disco: /^Discos de hoy:/,
};

describe.each(['cuaderno', 'linea', 'disco'] as const)('TodayScreen (%s)', (style) => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOON);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('invites to create the first habit when there are none', async () => {
    await renderRoute('/', { style });
    expect(await screen.findByText('Todavía no tienes hábitos.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Crear hábito' }).getAttribute('href')).toBe(
      '/habitos/nuevo',
    );
  });

  it("groups today's habits by anchor, in order, under the style's signature", async () => {
    const { db } = await renderRoute('/', { style });
    await addHabit(db, { name: 'Leer', anchor: 'Noche' });
    await addHabit(db, { name: 'Tomar agua', anchor: 'Al despertar' });
    await addHabit(db, { name: 'Correr', anchor: 'Mañana', weekdays: [1, 3] });

    await screen.findByRole('button', { name: 'Leer' });
    const groups = screen.getAllByRole('region').map((region) => region.getAttribute('aria-label'));
    expect(groups).toEqual(['Al despertar', 'Noche']);
    expect(screen.queryByRole('button', { name: 'Correr' })).toBeNull();
    expect(screen.getByRole('img', { name: SIGNATURES[style] })).toBeTruthy();
  });

  it('marks a habit with one tap and unmarks it with another after 400 ms', async () => {
    const { db, user } = await renderRoute('/', { style });
    const habit = await addHabit(db, { name: 'Meditar' });
    const button = await screen.findByRole('button', { name: 'Meditar' });
    expect(button.getAttribute('aria-pressed')).toBe('false');

    await user.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    await waitFor(async () => {
      expect((await db.checkIns.get(await checkInId(habit.id, TODAY)))?.status).toBe('done');
    });

    vi.setSystemTime(NOON.getTime() + 401);
    await user.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    await waitFor(async () => {
      expect((await db.checkIns.get(await checkInId(habit.id, TODAY)))?.deletedAt).not.toBeNull();
    });
  });

  it('keeps a habit marked after two taps within 400 ms, with a single write', async () => {
    const { db, user } = await renderRoute('/', { style });
    await addHabit(db, { name: 'Meditar' });
    const button = await screen.findByRole('button', { name: 'Meditar' });
    let writes = 0;
    const count = () => {
      writes += 1;
    };
    db.checkIns.hook('creating', count);
    db.checkIns.hook('updating', count);

    await user.click(button);
    vi.setSystemTime(NOON.getTime() + 250);
    await user.click(button);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(writes).toBe(1);
    });
    // Let any late second write land before counting again.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(writes).toBe(1);
  });

  it('shows weekly progress on quota habits', async () => {
    const { db } = await renderRoute('/', { style });
    const gym = await addHabit(db, { name: 'Gimnasio', mode: 'weekly_quota', weeklyQuota: 3 });
    await checkInsRepo(db).markDone(gym.id, parseLocalDate('2026-10-20'));
    await checkInsRepo(db).markDone(gym.id, parseLocalDate('2026-10-22'));

    const row = await screen.findByRole('listitem', { name: 'Gimnasio' });
    expect(await within(row).findByText('2 de 3 esta semana')).toBeTruthy();
  });
});
