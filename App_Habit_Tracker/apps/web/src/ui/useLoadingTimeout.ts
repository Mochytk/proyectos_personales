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
  useEffect(() => {
    setTimedOut(false);
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
