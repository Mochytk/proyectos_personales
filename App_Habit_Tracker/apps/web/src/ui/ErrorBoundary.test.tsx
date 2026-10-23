import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Flaky() {
  if (shouldThrow) throw new Error('boom');
  return <p>Sección lista</p>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = true;
    // React logs caught render errors; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('contains a child that throws', () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo falló en esta sección.')).toBeTruthy();
  });

  it('remounts the section on retry', () => {
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(screen.getByText('Sección lista')).toBeTruthy();
  });
});
