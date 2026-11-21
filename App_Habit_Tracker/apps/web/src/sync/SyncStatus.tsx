import { Link } from 'react-router';
import type { SyncResult } from './engine';

function label(result: SyncResult | null, pending: boolean): string {
  switch (result?.status) {
    case 'offline':
      return 'Sin conexión';
    case 'unauthenticated':
      return 'Inicia sesión para sincronizar';
    case 'error':
      return `Error: ${result.message}`;
    case 'synced':
      return pending ? 'Pendiente' : 'Sincronizado';
    case undefined:
      return pending ? 'Pendiente' : '';
  }
}

// The four states of ADR 0006, plus the one for no session. Announced politely.
// Without a session it leads to the account screen.
export function SyncStatus({ result, pending }: { result: SyncResult | null; pending: boolean }) {
  const text = label(result, pending);
  return (
    <p className="sync-status" role="status">
      {result?.status === 'unauthenticated' ? <Link to="/cuenta">{text}</Link> : text}
    </p>
  );
}
