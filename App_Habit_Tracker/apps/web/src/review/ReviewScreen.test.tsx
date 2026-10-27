import { parseLocalDate, quotaOverrideId, weeklyReviewId } from '@habit-tracker/shared';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkInsRepo } from '../db/check-ins-repo';
import { addHabit } from '../test/fixtures';
import { renderRoute } from '../test/render';

// Noon in Santiago (UTC-3 in October) on the given day.
function at(date: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(`${date}T15:00:00.000Z`);
}

const WEEK = parseLocalDate('2026-10-19');

describe('ReviewScreen', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['Sunday shows the week in progress', '2026-10-25', 'Semana del 19-10 al 25-10-2026'],
    ['Monday shows the week that just closed', '2026-10-26', 'Semana del 19-10 al 25-10-2026'],
    ['Saturday shows the last closed week', '2026-10-24', 'Semana del 12-10 al 18-10-2026'],
  ])('%s', async (_, day, title) => {
    at(day);
    const { db } = await renderRoute('/revision');
    await addHabit(db, { name: 'Leer' });
    expect(await screen.findByText(title)).toBeTruthy();
  });

  it('summarises each habit for the week', async () => {
    at('2026-10-26');
    const { db } = await renderRoute('/revision');
    const read = await addHabit(db, { name: 'Leer', weekdays: [1, 3, 5] });
    const gym = await addHabit(db, { name: 'Gimnasio', mode: 'weekly_quota', weeklyQuota: 3 });
    const repo = checkInsRepo(db);
    await repo.markDone(read.id, parseLocalDate('2026-10-19'));
    await repo.skip(read.id, parseLocalDate('2026-10-21'), 'certamen');
    for (const day of ['2026-10-20', '2026-10-22', '2026-10-24']) {
      await repo.markDone(gym.id, parseLocalDate(day));
    }

    const readRow = await screen.findByRole('listitem', { name: 'Leer' });
    expect(await within(readRow).findByText('1 hecho · 1 saltado · 1 sin hacer')).toBeTruthy();
    await repo.markDone(read.id, parseLocalDate('2026-10-23'));
    expect(
      await within(readRow).findByText('2 hechos · 1 saltado · 0 sin hacer · Racha: 2 días'),
    ).toBeTruthy();
    const gymRow = await screen.findByRole('listitem', { name: 'Gimnasio' });
    expect(await within(gymRow).findByText('3 de 3 · Cumplido · Racha: 1 semana')).toBeTruthy();
  });

  it('saves the reflection for the week', async () => {
    at('2026-10-25');
    const { db, user } = await renderRoute('/revision');
    await addHabit(db, { name: 'Leer' });

    await user.type(
      await screen.findByLabelText('Reflexión de la semana (opcional)'),
      'Me costó leer los días de certamen.',
    );
    await user.click(screen.getByRole('button', { name: 'Guardar reflexión' }));

    await waitFor(async () => {
      expect((await db.weeklyReviews.get(await weeklyReviewId(WEEK)))?.reflection).toBe(
        'Me costó leer los días de certamen.',
      );
    });
  });

  it('sets the quota of the next week for weekly habits', async () => {
    at('2026-10-25');
    const { db, user } = await renderRoute('/revision');
    const gym = await addHabit(db, { name: 'Gimnasio', mode: 'weekly_quota', weeklyQuota: 3 });

    const select = await screen.findByLabelText('Gimnasio: veces la semana del 26-10');
    expect((select as HTMLSelectElement).value).toBe('3');
    await user.selectOptions(select, '2');

    const nextWeek = parseLocalDate('2026-10-26');
    await waitFor(async () => {
      expect(
        await db.weeklyQuotaOverrides.get(await quotaOverrideId(gym.id, nextWeek)),
      ).toMatchObject({ habitId: gym.id, weekStart: nextWeek, quota: 2 });
    });
  });

  it('marks the review as done', async () => {
    at('2026-10-25');
    const { db, user } = await renderRoute('/revision');
    await addHabit(db, { name: 'Leer' });

    await user.click(await screen.findByRole('button', { name: 'Marcar revisión como hecha' }));

    expect(await screen.findByText('Revisión hecha el 25-10-2026.')).toBeTruthy();
    expect((await db.weeklyReviews.get(await weeklyReviewId(WEEK)))?.completedAt).toBe(
      '2026-10-25T15:00:00.000Z',
    );
    expect(screen.queryByRole('button', { name: 'Marcar revisión como hecha' })).toBeNull();
  });
});
