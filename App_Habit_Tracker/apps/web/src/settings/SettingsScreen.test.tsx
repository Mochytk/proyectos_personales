import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settingsId } from '../db/defaults';
import { renderRoute } from '../test/render';

describe('SettingsScreen', () => {
  beforeEach(() => {
    // 02:00 on 24-10-2026 in Santiago: before the default 04:00 cutoff.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-10-24T05:00:00.000Z');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('applies a new day cutoff to today right away', async () => {
    const { db, user } = await renderRoute('/ajustes');
    const cutoff = await screen.findByLabelText('Hora de corte');
    expect(await screen.findByText('Ahora cuenta como el 23-10-2026.')).toBeTruthy();

    await user.selectOptions(cutoff, '00:00');

    expect(await screen.findByText('Ahora cuenta como el 24-10-2026.')).toBeTruthy();
    expect((await db.userSettings.get(await settingsId()))?.dayCutoffHour).toBe(0);
  });

  it('shows the time zone, Santiago by default, and that it only affects new records', async () => {
    const { db, user } = await renderRoute('/ajustes');
    const zone = await screen.findByLabelText<HTMLSelectElement>('Zona horaria');
    expect(zone.value).toBe('America/Santiago');
    expect(screen.getByText('Cambiarla solo afecta a los registros nuevos.')).toBeTruthy();

    await user.selectOptions(zone, 'Europe/Madrid');
    await waitFor(async () => {
      expect((await db.userSettings.get(await settingsId()))?.timeZone).toBe('Europe/Madrid');
    });
  });

  it('switches the style at once and saves it', async () => {
    const { db, user } = await renderRoute('/ajustes');
    const group = await screen.findByRole('radiogroup', { name: 'Estilo' });
    expect(group).toBeTruthy();
    const notebook = screen.getByRole<HTMLInputElement>('radio', { name: 'Cuaderno' });
    expect(notebook.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'Rotar cada semana' })).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'Disco' }));

    await waitFor(() => {
      expect(document.documentElement.dataset.style).toBe('disco');
    });
    expect((await db.userSettings.get(await settingsId()))?.style).toBe('disco');
  });
});
