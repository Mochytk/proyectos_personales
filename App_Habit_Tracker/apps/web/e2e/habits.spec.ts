import { expect, test } from '@playwright/test';
import { createHabit, habitToggle } from './helpers';

test('creates a daily habit, marks it on Hoy and keeps it after a reload', async ({ page }) => {
  await createHabit(page, { name: 'Leer 20 minutos', anchor: 'Noche' });

  await page.getByRole('link', { name: 'Hoy' }).click();
  const toggle = habitToggle(page, 'Leer 20 minutos');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(habitToggle(page, 'Leer 20 minutos')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('listitem', { name: 'Leer 20 minutos' })).toContainText(
    'Racha: 1 día',
  );
});

test('skips a habit with a reason', async ({ page }) => {
  await createHabit(page, { name: 'Correr' });
  await page.goto('/');

  await page.getByRole('button', { name: 'Más opciones para Correr' }).click();
  const sheet = page.getByRole('dialog', { name: 'Saltar Correr' });
  await sheet.getByLabel('Nota (opcional)').fill('Certamen de cálculo');
  await sheet.getByRole('button', { name: 'Certamen' }).click();

  await expect(sheet).toBeHidden();
  await expect(page.getByRole('listitem', { name: 'Correr' })).toContainText('Saltado: certamen');
});

test('pauses the day without touching what is already marked', async ({ page }) => {
  await createHabit(page, { name: 'Tomar agua' });
  await createHabit(page, { name: 'Leer', anchor: 'Noche' });
  await page.goto('/');
  await habitToggle(page, 'Tomar agua').click();
  await expect(habitToggle(page, 'Tomar agua')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Pausar el día' }).click();
  await page
    .getByRole('dialog', { name: 'Pausar el día' })
    .getByRole('button', { name: 'Enfermedad' })
    .click();

  await expect(page.getByRole('listitem', { name: 'Leer' })).toContainText('Saltado: enfermedad');
  await expect(habitToggle(page, 'Tomar agua')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Pausar el día' })).toBeDisabled();
});

test('shows the progress of a weekly quota habit', async ({ page }) => {
  await createHabit(page, { name: 'Gimnasio', anchor: 'Después de entrenar', quota: 3 });
  await page.goto('/');
  const row = page.getByRole('listitem', { name: 'Gimnasio' });
  await expect(row).toContainText('0 de 3 esta semana');

  await habitToggle(page, 'Gimnasio').click();
  await expect(row).toContainText('1 de 3 esta semana');
});

test('archives a habit and brings it back', async ({ page }) => {
  await createHabit(page, { name: 'Meditar' });

  await page.getByRole('button', { name: 'Archivar Meditar' }).click();
  const archived = page.getByRole('region', { name: 'Archivados' });
  await expect(archived.getByRole('link', { name: 'Meditar' })).toBeVisible();
  await page.goto('/');
  await expect(page.getByText('Todavía no tienes hábitos.')).toBeVisible();

  await page.goto('/habitos');
  await page.getByRole('button', { name: 'Reactivar Meditar' }).click();
  await expect(page.getByRole('region', { name: 'Archivados' })).toBeHidden();
  await page.goto('/');
  await expect(habitToggle(page, 'Meditar')).toBeVisible();
});

test('reviews the week on Sunday', async ({ page }) => {
  // Noon on Sunday 25-10-2026 in Santiago. Timers keep running, so IndexedDB works.
  await page.clock.setFixedTime(new Date('2026-10-25T15:00:00.000Z'));
  await createHabit(page, { name: 'Leer' });
  await createHabit(page, { name: 'Gimnasio', quota: 3 });
  await page.goto('/');
  await habitToggle(page, 'Leer').click();
  await expect(habitToggle(page, 'Leer')).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('link', { name: 'Revisión' }).click();
  await expect(page.getByText('Semana del 19-10 al 25-10-2026')).toBeVisible();
  await expect(page.getByRole('listitem', { name: 'Leer' })).toContainText(
    '1 hecho · 0 saltados · 0 sin hacer · Racha: 1 día',
  );
  await expect(page.getByRole('listitem', { name: 'Gimnasio' })).toContainText(
    '0 de 3 · No cumplido',
  );

  await page.getByLabel('Gimnasio: veces la semana del 26-10').selectOption('2');
  await page.getByLabel('Reflexión de la semana (opcional)').fill('Semana de certámenes.');
  await page.getByRole('button', { name: 'Guardar reflexión' }).click();
  await expect(page.getByText('Guardada.')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar revisión como hecha' }).click();
  await expect(page.getByText('Revisión hecha el 25-10-2026.')).toBeVisible();

  await page.reload();
  await expect(page.getByLabel('Reflexión de la semana (opcional)')).toHaveValue(
    'Semana de certámenes.',
  );
  await expect(page.getByLabel('Gimnasio: veces la semana del 26-10')).toHaveValue('2');
});

test('explains when the device storage is unavailable, in the right colors', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined });
  });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  await expect(page.getByRole('alert')).toContainText(
    'No pudimos abrir el almacenamiento de este dispositivo.',
  );
  const colors = await page.evaluate(() => ({
    meta: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
    body: getComputedStyle(document.body).backgroundColor,
  }));
  expect(colors.meta).toBe(colors.body);
  expect(colors.body).not.toBe('rgb(255, 255, 255)');
});
