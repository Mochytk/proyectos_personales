import { test as base, expect, type Page } from '@playwright/test';

// Every test fails on a console error or an uncaught exception, CSP violations included.
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      await provide(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

export const STYLES = ['cuaderno', 'linea', 'disco'] as const;
export type Style = (typeof STYLES)[number];

const STYLE_LABELS: Record<Style, string> = {
  cuaderno: 'Cuaderno',
  linea: 'Línea',
  disco: 'Disco',
};

interface NewHabit {
  name: string;
  anchor?: string;
  quota?: number;
  // ISO weekdays to leave out, by their Spanish name ("Sábado").
  without?: string[];
}

// Creates a habit through the form, the way a person would.
export async function createHabit(page: Page, habit: NewHabit): Promise<void> {
  await page.goto('/habitos/nuevo');
  await page.getByLabel('Nombre').fill(habit.name);
  if (habit.anchor) await page.getByLabel('Ancla').selectOption({ label: habit.anchor });
  if (habit.quota !== undefined) {
    await page.getByRole('radio', { name: 'Cuota semanal' }).check();
    await page.getByLabel('Veces por semana').fill(String(habit.quota));
  }
  for (const day of habit.without ?? []) {
    await page.getByRole('checkbox', { name: day }).uncheck();
  }
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('link', { name: `Editar ${habit.name}` })).toBeVisible();
}

export async function chooseStyle(page: Page, style: Style): Promise<void> {
  await page.goto('/ajustes');
  await page.getByRole('radio', { name: STYLE_LABELS[style] }).check();
  await expect(page.locator('html')).toHaveAttribute('data-style', style);
}

// The tap target of a habit on "Hoy" (its "Más opciones" button shares the name).
export function habitToggle(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}
