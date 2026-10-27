import { useEffect, useState } from 'react';

export const LOADING_TIMEOUT_MS = 8000;

// True once something has been loading for longer than `timeoutMs`, so no screen
// shows a spinner forever (RNF-4). `attempt` restarts the clock after a retry.
export function useLoadingTimeout(
  isLoading: boolean,
  timeoutMs = LOADING_TIMEOUT_MS,
  attempt = 0,
): boolean {
  const [timedOut, setTimedOut] = useState(false);
  // A new load (or a retry) starts with a fresh clock: reset while rendering, which
  // React supports for state derived from changed inputs, instead of in the effect.
  const [started, setStarted] = useState({ isLoading, attempt });
  if (started.isLoading !== isLoading || started.attempt !== attempt) {
    setStarted({ isLoading, attempt });
    setTimedOut(false);
  }

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);
    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, timeoutMs, attempt]);

  return isLoading && timedOut;
}
