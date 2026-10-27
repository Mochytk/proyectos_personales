import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { chooseStyle, createHabit, habitToggle, STYLES } from './helpers';

const SCREENS = ['/', '/habitos', '/revision', '/ajustes'];

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`${style} in ${scheme} mode: Hoy screenshot and no accessibility violations`, async ({
      page,
    }, testInfo) => {
      await createHabit(page, { name: 'Tomar agua', anchor: 'Al despertar' });
      await createHabit(page, { name: 'Estudiar 1 hora', anchor: 'Tarde' });
      await createHabit(page, { name: 'Gimnasio', anchor: 'Después de entrenar', quota: 3 });
      await createHabit(page, { name: 'Leer 20 minutos', anchor: 'Noche' });
      await chooseStyle(page, style);
      await page.emulateMedia({ colorScheme: scheme });

      await page.goto('/');
      await habitToggle(page, 'Tomar agua').click();
      await habitToggle(page, 'Gimnasio').click();
      await expect(habitToggle(page, 'Gimnasio')).toHaveAttribute('aria-pressed', 'true');
      await page.screenshot({
        path: testInfo.outputPath(`hoy-${style}-${scheme}-${testInfo.project.name}.png`),
        fullPage: true,
      });

      for (const screen of SCREENS) {
        await page.goto(screen);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        expect(
          results.violations.map((v) => `${screen}: ${v.id} (${String(v.nodes.length)})`),
        ).toEqual([]);
      }
    });
  }
}
