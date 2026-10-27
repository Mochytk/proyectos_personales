import { checkInId, parseLocalDate } from '@habit-tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkInsRepo } from '../db/check-ins-repo';
import { addHabit } from '../test/fixtures';
import { renderRoute } from '../test/render';

const TODAY = parseLocalDate('2026-10-23');

describe('SkipSheet', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-10-23T15:00:00.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens from "Más opciones" with the five reasons and an optional note', async () => {
    const { db, user } = await renderRoute('/');
    await addHabit(db, { name: 'Leer' });

    await user.click(await screen.findByRole('button', { name: 'Más opciones para Leer' }));

    const sheet = screen.getByRole('dialog', { name: 'Saltar Leer' });
    for (const reason of ['Certamen', 'Enfermedad', 'Viaje', 'Descanso', 'Otro']) {
      expect(within(sheet).getByRole('button', { name: reason })).toBeTruthy();
    }
    expect(within(sheet).getByLabelText('Nota (opcional)')).toBeTruthy();
    expect(document.activeElement?.textContent).toBe('Certamen');
  });

  it('skips the habit with the chosen reason and note', async () => {
    const { db, user } = await renderRoute('/');
    const habit = await addHabit(db, { name: 'Leer' });

    await user.click(await screen.findByRole('button', { name: 'Más opciones para Leer' }));
    const sheet = screen.getByRole('dialog', { name: 'Saltar Leer' });
    await user.type(within(sheet).getByLabelText('Nota (opcional)'), 'Certamen de cálculo');
    await user.click(within(sheet).getByRole('button', { name: 'Certamen' }));

    await waitFor(async () => {
      expect(await db.checkIns.get(await checkInId(habit.id, TODAY))).toMatchObject({
        status: 'skipped',
        skipReason: 'certamen',
        note: 'Certamen de cálculo',
      });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Más opciones para Leer');
    const row = screen.getByRole('listitem', { name: 'Leer' });
    expect(await within(row).findByText('Saltado: certamen')).toBeTruthy();
  });

  it('keeps Tab inside the sheet', async () => {
    const { db, user } = await renderRoute('/');
    await addHabit(db, { name: 'Leer' });

    await user.click(await screen.findByRole('button', { name: 'Más opciones para Leer' }));
    const sheet = screen.getByRole('dialog', { name: 'Saltar Leer' });
    within(sheet).getByRole('button', { name: 'Cancelar' }).focus();
    await user.tab();

    expect(document.activeElement).toBe(within(sheet).getByLabelText('Nota (opcional)'));
  });

  it('closes with Escape without saving', async () => {
    const { db, user } = await renderRoute('/');
    await addHabit(db, { name: 'Leer' });

    await user.click(await screen.findByRole('button', { name: 'Más opciones para Leer' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await db.checkIns.count()).toBe(0);
  });

  it('pauses the day: skips every pending habit with one reason, leaving marked ones', async () => {
    const { db, user } = await renderRoute('/');
    const done = await addHabit(db, { name: 'Tomar agua' });
    const pending = await addHabit(db, { name: 'Leer', anchor: 'Noche' });
    const gym = await addHabit(db, { name: 'Gimnasio', mode: 'weekly_quota', weeklyQuota: 3 });
    await checkInsRepo(db).markDone(done.id, TODAY);

    await user.click(await screen.findByRole('button', { name: 'Pausar el día' }));
    const sheet = screen.getByRole('dialog', { name: 'Pausar el día' });
    expect(within(sheet).queryByLabelText('Nota (opcional)')).toBeNull();
    await user.click(within(sheet).getByRole('button', { name: 'Enfermedad' }));

    await waitFor(async () => {
      expect((await db.checkIns.get(await checkInId(pending.id, TODAY)))?.skipReason).toBe(
        'enfermedad',
      );
    });
    expect((await db.checkIns.get(await checkInId(gym.id, TODAY)))?.status).toBe('skipped');
    expect((await db.checkIns.get(await checkInId(done.id, TODAY)))?.status).toBe('done');
  });
});
