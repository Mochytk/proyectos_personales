import { parseLocalDate } from '@habit-tracker/shared';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDb } from '../db/db';
import { settingsId } from '../db/defaults';
import { writeRows } from '../db/write';
import { App } from './App';
import { useStyle } from './useStyle';

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders Hoy as the default tab', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Hoy' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Hábitos' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the tab of the current route', async () => {
    render(
      <MemoryRouter initialEntries={['/ajustes']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Ajustes' });
    expect(heading.textContent).toBe('Ajustes');
  });

  it('applies the style saved in the settings', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { level: 1, name: 'Hoy' });

    const db = await openDb();
    const saved = await db.userSettings.get(await settingsId());
    if (!saved) throw new Error('missing settings');
    await writeRows(db, 'userSettings', [{ ...saved, style: 'disco' }]);
    db.close();

    await waitFor(() => {
      expect(document.documentElement.dataset.style).toBe('disco');
    });
  });

  it('explains when the device storage cannot be opened', async () => {
    vi.stubGlobal('indexedDB', undefined);
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('No pudimos abrir el almacenamiento de este dispositivo.');
    expect(alert.textContent).toContain('navegación privada');
    expect(screen.getByRole('link', { name: 'Hoy' })).toBeTruthy();
  });
});

function StyleProbe({ setting }: { setting: Parameters<typeof useStyle>[0] }) {
  useStyle(setting, parseLocalDate('2026-10-23'));
  return null;
}

describe('useStyle', () => {
  it('sets data-style on the html element and follows the setting', () => {
    const { rerender } = render(<StyleProbe setting="linea" />);
    expect(document.documentElement.dataset.style).toBe('linea');

    rerender(<StyleProbe setting="disco" />);
    expect(document.documentElement.dataset.style).toBe('disco');

    rerender(<StyleProbe setting="rotate" />);
    expect(document.documentElement.dataset.style).toBe('cuaderno');
  });
});
