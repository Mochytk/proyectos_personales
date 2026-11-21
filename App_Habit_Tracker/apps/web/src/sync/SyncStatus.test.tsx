import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { SyncStatus } from './SyncStatus';

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe('SyncStatus', () => {
  it('goes from "Pendiente" to "Sincronizado" once the outbox empties', () => {
    const { rerender } = render(<SyncStatus result={{ status: 'synced' }} pending />, { wrapper });
    expect(screen.getByRole('status').textContent).toBe('Pendiente');
    rerender(<SyncStatus result={{ status: 'synced' }} pending={false} />);
    expect(screen.getByRole('status').textContent).toBe('Sincronizado');
  });

  it('names each problem', () => {
    const { rerender } = render(<SyncStatus result={{ status: 'offline' }} pending />, { wrapper });
    expect(screen.getByRole('status').textContent).toBe('Sin conexión');
    rerender(<SyncStatus result={{ status: 'unauthenticated' }} pending />);
    expect(screen.getByRole('status').textContent).toBe('Inicia sesión para sincronizar');
    const link = screen.getByRole('link', { name: 'Inicia sesión para sincronizar' });
    expect(link.getAttribute('href')).toBe('/cuenta');
    rerender(<SyncStatus result={{ status: 'error', message: 'invalid_batch' }} pending />);
    expect(screen.getByRole('status').textContent).toBe('Error: invalid_batch');
  });

  it('shows "Pendiente" before the first sync answers, if there is something to send', () => {
    const { rerender } = render(<SyncStatus result={null} pending />, { wrapper });
    expect(screen.getByRole('status').textContent).toBe('Pendiente');
    rerender(<SyncStatus result={null} pending={false} />);
    expect(screen.getByRole('status').textContent).toBe('');
  });
});
