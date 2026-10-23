import { parseLocalDate } from '@habit-tracker/shared';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { useStyle } from './useStyle';

describe('App', () => {
  it('renders Hoy as the default tab', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Hoy' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Hábitos' }).getAttribute('aria-current')).toBeNull();
  });

  it('marks the tab of the current route', () => {
    render(
      <MemoryRouter initialEntries={['/ajustes']}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Ajustes' }).getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('heading', { level: 1, name: 'Ajustes' }).textContent).toBe('Ajustes');
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
