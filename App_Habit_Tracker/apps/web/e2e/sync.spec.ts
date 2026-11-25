import { test as base, expect, type Page } from '@playwright/test';
import { createHabit, habitToggle } from './helpers';

const PASSWORD = 'correct horse battery';
let ipCounter = 0;

// Each "device" is its own browser context with its own client IP (wrangler dev passes
// cf-connecting-ip through), so the sign-in rate limit treats them as separate phones.
// A failed request to /api is expected here (cut connections, closed sessions); any other
// console error or uncaught exception still fails the test.
const test = base.extend<{ device: () => Promise<Page> }>({
  device: async ({ browser }, provide) => {
    const errors: string[] = [];
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await provide(async () => {
      ipCounter += 1;
      const context = await browser.newContext({
        extraHTTPHeaders: { 'cf-connecting-ip': `198.51.100.${String(ipCounter)}` },
      });
      contexts.push(context);
      const page = await context.newPage();
      page.on('console', (message) => {
        const expected =
          message.text().startsWith('Failed to load resource') &&
          message.location().url.includes('/api/');
        if (message.type() === 'error' && !expected) errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
    expect(errors).toEqual([]);
  },
});

function email(name: string): string {
  return `${name}-${String(Date.now())}@example.com`;
}

function syncStatus(page: Page) {
  return page.locator('.sync-status');
}

async function createAccount(page: Page, address: string) {
  await page.goto('/cuenta');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByLabel('Correo para la cuenta').fill(address);
  await page.getByLabel('Contraseña para la cuenta').fill(PASSWORD);
  await page.getByRole('button', { name: 'Crear la cuenta' }).click();
  await expect(page.getByText(`Sesión iniciada como ${address}`)).toBeVisible();
}

async function signIn(page: Page, address: string) {
  await page.goto('/cuenta');
  await page.getByLabel('Correo', { exact: true }).fill(address);
  await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText(`Sesión iniciada como ${address}`)).toBeVisible();
}

test('a habit marked on one device shows up marked on the other within 30 s', async ({
  device,
}) => {
  const address = email('dos');
  const phone = await device();
  const mac = await device();
  await createAccount(phone, address);
  await signIn(mac, address);
  // The Mac sits on "Hoy" and only learns of the change through the 15 s version check.
  await mac.goto('/');
  await expect(syncStatus(mac)).toHaveText('Sincronizado');

  await createHabit(phone, { name: 'Leer en el teléfono' });
  await phone.getByRole('link', { name: 'Hoy' }).click();
  await habitToggle(phone, 'Leer en el teléfono').click();
  await expect(phone.getByRole('listitem', { name: 'Leer en el teléfono' })).toContainText(
    'Racha: 1 día',
  );
  await expect(syncStatus(phone)).toHaveText('Sincronizado', { timeout: 15_000 });

  await expect(habitToggle(mac, 'Leer en el teléfono')).toHaveAttribute('aria-pressed', 'true', {
    timeout: 30_000,
  });
});

test('a push whose answer is lost arrives exactly once after the retry', async ({ device }) => {
  const address = email('corte');
  const phone = await device();
  await createAccount(phone, address);
  await expect(syncStatus(phone)).toHaveText('Sincronizado');

  // The server applies the first push, but the phone never hears back.
  let pushes = 0;
  phone.on('request', (request) => {
    if (request.url().endsWith('/api/sync/push')) pushes += 1;
  });
  await phone.route(
    '**/api/sync/push',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );

  await createHabit(phone, { name: 'Correr' });
  await expect(syncStatus(phone)).toHaveText('Sincronizado', { timeout: 20_000 });
  expect(pushes).toBeGreaterThanOrEqual(2);

  const mac = await device();
  await signIn(mac, address);
  await mac.goto('/habitos');
  await expect(syncStatus(mac)).toHaveText('Sincronizado');
  await expect(mac.getByRole('link', { name: 'Editar Correr' })).toHaveCount(1);
});

test('another account sees none of the first one’s habits', async ({ device }) => {
  const owner = await device();
  await createAccount(owner, email('duena'));
  await createHabit(owner, { name: 'Hábito privado' });
  await expect(syncStatus(owner)).toHaveText('Sincronizado', { timeout: 15_000 });

  const stranger = await device();
  await createAccount(stranger, email('otra'));
  await stranger.goto('/habitos');
  await expect(syncStatus(stranger)).toHaveText('Sincronizado');
  await expect(stranger.getByText('Hábito privado')).toHaveCount(0);
});

test('closing every session keeps the other device’s pending changes until it signs in', async ({
  device,
}) => {
  const address = email('cierre');
  const phone = await device();
  const mac = await device();
  await createAccount(phone, address);
  await signIn(mac, address);
  await mac.goto('/');
  await expect(syncStatus(mac)).toHaveText('Sincronizado');

  await phone.goto('/cuenta');
  await phone.getByRole('button', { name: 'Cerrar sesión en todos los dispositivos' }).click();
  await phone.getByRole('button', { name: 'Sí, cerrar todas' }).click();
  await expect(phone.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();

  // The Mac still has its cookies, but the server no longer accepts them.
  await createHabit(mac, { name: 'Escrito sin sesión' });
  await expect(syncStatus(mac).getByRole('link')).toHaveText('Inicia sesión para sincronizar', {
    timeout: 15_000,
  });

  await signIn(mac, address);
  await expect(syncStatus(mac)).toHaveText('Sincronizado', { timeout: 15_000 });
  await signIn(phone, address);
  await phone.goto('/habitos');
  await expect(phone.getByRole('link', { name: 'Editar Escrito sin sesión' })).toBeVisible({
    timeout: 15_000,
  });
});
