import { liveQuery } from 'dexie';
import { useEffect, useState } from 'react';
import { LOADING_TIMEOUT_MS, useLoadingTimeout } from './useLoadingTimeout';

export interface TimedQuery<T> {
  state: 'loading' | 'ready' | 'timeout' | 'error';
  data?: T;
  retry: () => void;
}

type Result<T> = { state: 'loading' } | { state: 'ready'; data: T } | { state: 'error' };

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
}

// A Dexie live query that never loads forever (RNF-4): it reports errors instead of
// throwing, gives up after `timeoutMs`, and `retry()` subscribes again from scratch.
// Like useEffect, `deps` lists what the query reads from the component; ESLint checks
// them at each call site (`additionalHooks` in eslint.config.js).
export function useTimedLiveQuery<T>(
  query: () => Promise<T>,
  deps: unknown[],
  timeoutMs = LOADING_TIMEOUT_MS,
): TimedQuery<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result<T>>({ state: 'loading' });
  // New deps or a retry mean a new query: back to loading, reset while rendering.
  const [current, setCurrent] = useState({ deps, attempt });
  if (current.attempt !== attempt || !sameDeps(current.deps, deps)) {
    setCurrent({ deps, attempt });
    setResult({ state: 'loading' });
  }

  useEffect(() => {
    const subscription = liveQuery(query).subscribe({
      next: (data) => {
        setResult({ state: 'ready', data });
      },
      error: () => {
        setResult({ state: 'error' });
      },
    });
    return () => {
      subscription.unsubscribe();
    };
    // The caller's deps stand for everything `query` reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const timedOut = useLoadingTimeout(result.state === 'loading', timeoutMs, attempt);
  const retry = () => {
    setAttempt((n) => n + 1);
  };

  if (timedOut) return { state: 'timeout', retry };
  return result.state === 'ready'
    ? { state: 'ready', data: result.data, retry }
    : { state: result.state, retry };
}
