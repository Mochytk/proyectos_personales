import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openTestDb } from '../test/db';
import { useTimedLiveQuery } from './useTimedLiveQuery';

describe('useTimedLiveQuery', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the data and follows later changes', async () => {
    const db = await openTestDb();
    const { result } = renderHook(() => useTimedLiveQuery(() => db.anchors.count(), []));
    expect(result.current.state).toBe('loading');

    await waitFor(() => {
      expect(result.current).toMatchObject({ state: 'ready', data: 0 });
    });

    await db.anchors.put({
      id: crypto.randomUUID(),
      createdAt: '2026-10-23T15:00:00.000Z',
      updatedAt: '2026-10-23T15:00:00.000Z',
      deletedAt: null,
      name: 'Mañana',
      sortOrder: 0,
      archivedAt: null,
    });
    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });
  });

  it('times out after 8000 ms and starts over on retry', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useTimedLiveQuery(() => new Promise<number>(() => undefined), []),
    );

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(result.current.state).toBe('loading');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state).toBe('timeout');

    act(() => {
      result.current.retry();
    });
    expect(result.current.state).toBe('loading');
  });

  it('reports a failing query as an error', async () => {
    const { result } = renderHook(() =>
      useTimedLiveQuery(() => Promise.reject(new Error('boom')), []),
    );
    await waitFor(() => {
      expect(result.current.state).toBe('error');
    });
  });
});
