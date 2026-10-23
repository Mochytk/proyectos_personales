import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncState } from './AsyncState';

describe('AsyncState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading, then a timeout message with a retry after 8000 ms', () => {
    const onRetry = vi.fn();
    render(
      <AsyncState status="loading" onRetry={onRetry}>
        <p>Contenido</p>
      </AsyncState>,
    );
    expect(screen.getByText('Cargando…')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(screen.queryByText('Está tardando más de lo normal.')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Está tardando más de lo normal.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Cargando…')).toBeTruthy();
  });

  it('shows the timeout message right away for a query that already timed out', () => {
    render(
      <AsyncState status="timeout" onRetry={vi.fn()}>
        <p>Contenido</p>
      </AsyncState>,
    );
    expect(screen.getByText('Está tardando más de lo normal.')).toBeTruthy();
  });

  it('shows an error with a retry', () => {
    const onRetry = vi.fn();
    render(
      <AsyncState status="error" onRetry={onRetry}>
        <p>Contenido</p>
      </AsyncState>,
    );
    expect(screen.getByText('No pudimos cargar esto.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows the empty state when ready with nothing to show', () => {
    render(
      <AsyncState
        status="ready"
        isEmpty
        empty={<p>Todavía no tienes hábitos.</p>}
        onRetry={vi.fn()}
      >
        <p>Contenido</p>
      </AsyncState>,
    );
    expect(screen.getByText('Todavía no tienes hábitos.')).toBeTruthy();
    expect(screen.queryByText('Contenido')).toBeNull();
  });

  it('shows the content when ready', () => {
    render(
      <AsyncState status="ready" onRetry={vi.fn()}>
        <p>Contenido</p>
      </AsyncState>,
    );
    expect(screen.getByText('Contenido')).toBeTruthy();
  });
});
