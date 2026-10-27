import { useState, type ReactNode } from 'react';
import { LOADING_TIMEOUT_MS, useLoadingTimeout } from './useLoadingTimeout';

interface Props {
  status: 'loading' | 'ready' | 'timeout' | 'error';
  isEmpty?: boolean;
  empty?: ReactNode;
  onRetry: () => void;
  timeoutMs?: number;
  children: ReactNode;
}

// Picks between loading, timeout, error, empty and content, so every view handles all
// of them the same way. It times out on its own, or takes the state of useTimedLiveQuery.
export function AsyncState({
  status,
  isEmpty = false,
  empty = null,
  onRetry,
  timeoutMs = LOADING_TIMEOUT_MS,
  children,
}: Props) {
  const [attempt, setAttempt] = useState(0);
  const timedOut = useLoadingTimeout(status === 'loading', timeoutMs, attempt);

  const retry = () => {
    setAttempt((n) => n + 1);
    onRetry();
  };

  if (status === 'error' || status === 'timeout' || timedOut) {
    return (
      <div className="async-problem" role="alert">
        <p>{status === 'error' ? 'No pudimos cargar esto.' : 'Está tardando más de lo normal.'}</p>
        <button type="button" className="button" onClick={retry}>
          Reintentar
        </button>
      </div>
    );
  }
  if (status === 'loading') {
    return (
      <p className="async-loading" role="status">
        Cargando…
      </p>
    );
  }
  return isEmpty ? empty : children;
}
