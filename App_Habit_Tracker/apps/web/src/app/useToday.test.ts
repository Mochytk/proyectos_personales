import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalDate } from './useToday';

// 03:59 on 24-10-2026 in Santiago (UTC-3 in October).
const BEFORE_CUTOFF = '2026-10-24T06:59:00.000Z';

describe('useLocalDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_CUTOFF);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rolls over to the next day at the cutoff without remounting', () => {
    const { result } = renderHook(() => useLocalDate('America/Santiago', 4));
    expect(result.current).toBe('2026-10-23');

    act(() => {
      vi.advanceTimersByTime(2 * 60_000);
    });
    expect(result.current).toBe('2026-10-24');
  });

  it('catches up as soon as the app comes back to the front', () => {
    const { result } = renderHook(() => useLocalDate('America/Santiago', 4));

    vi.setSystemTime('2026-10-24T07:01:00.000Z');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('2026-10-24');

    vi.setSystemTime('2026-10-25T07:01:00.000Z');
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe('2026-10-25');
  });

  it('follows a new time zone or cutoff right away', () => {
    const { result, rerender } = renderHook(
      ({ cutoff }: { cutoff: number }) => useLocalDate('America/Santiago', cutoff),
      { initialProps: { cutoff: 4 } },
    );
    expect(result.current).toBe('2026-10-23');

    rerender({ cutoff: 3 });
    expect(result.current).toBe('2026-10-24');
  });
});
