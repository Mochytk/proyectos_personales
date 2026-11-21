import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getSession } from '../account/auth-api';
import { SESSION_EVENT } from '../account/session-events';
import type { HabitDb } from '../db/db';
import { syncOnce, type SyncResult } from './engine';
import { SyncScheduler } from './scheduler';
import { httpSyncApi, type SyncApi } from './sync-api';

// Checks the session first, so a device without an account never sends a push the
// server would refuse. get-session answers from the signed cookie, without Postgres.
async function attemptSync(db: HabitDb, api: SyncApi): Promise<SyncResult> {
  if (!navigator.onLine) return { status: 'offline' };
  const session = await getSession();
  if (!session.ok) {
    return session.error === 'offline'
      ? { status: 'offline' }
      : { status: 'error', message: 'session' };
  }
  if (session.data === null) return { status: 'unauthenticated' };
  return syncOnce(db, api);
}

// Syncs on open, on sign-in, when the app comes back into view, when the connection
// returns, 2 s after local writes, and when the server's version moves past ours.
export function useSync(
  db: HabitDb,
  api: SyncApi = httpSyncApi,
): { result: SyncResult | null; pending: boolean } {
  const [result, setResult] = useState<SyncResult | null>(null);
  const pending = (useLiveQuery(() => db.outbox.count(), [db]) ?? 0) > 0;

  useEffect(() => {
    const scheduler = new SyncScheduler({
      attempt: () => attemptSync(db, api),
      version: async () => {
        const answer = await api.version();
        return answer.status === 'ok' ? answer.data : null;
      },
      cursor: async () => (await db.syncState.get('sync'))?.cursor ?? 0,
      visible: () => document.visibilityState === 'visible',
      onResult: setResult,
    });

    const onRequest = () => {
      scheduler.request();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') scheduler.request();
    };
    window.addEventListener('online', onRequest);
    window.addEventListener(SESSION_EVENT, onRequest);
    document.addEventListener('visibilitychange', onVisibility);

    // The newest outbox entry changes on every local write; the first value is the
    // state at start-up, which start() already covers.
    let initial = true;
    const writes = liveQuery(() => db.outbox.orderBy('queuedAt').last()).subscribe({
      next: (entry) => {
        if (initial) {
          initial = false;
          return;
        }
        if (entry) scheduler.localWrite();
      },
    });

    scheduler.start();
    return () => {
      scheduler.stop();
      writes.unsubscribe();
      window.removeEventListener('online', onRequest);
      window.removeEventListener(SESSION_EVENT, onRequest);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [db, api]);

  return { result, pending };
}
