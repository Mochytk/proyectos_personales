import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AsyncState } from '../ui/AsyncState';
import { openDb, StorageUnavailableError, type HabitDb } from './db';

const DbContext = createContext<HabitDb | null>(null);

export function useDb(): HabitDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used inside <DatabaseProvider>');
  return db;
}

type OpenState =
  | { status: 'opening' }
  | { status: 'open'; db: HabitDb }
  | { status: 'unavailable' }
  | { status: 'error' };

interface Props {
  open?: () => Promise<HabitDb>;
  children: ReactNode;
}

// Opens the local database once and hands it to the screens. Nothing renders until it is open.
export function DatabaseProvider({ open = openDb, children }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<OpenState>({ status: 'opening' });

  useEffect(() => {
    let cancelled = false;
    let opened: HabitDb | undefined;
    setState({ status: 'opening' });
    open().then(
      (db) => {
        opened = db;
        if (cancelled) db.close();
        else setState({ status: 'open', db });
      },
      (error: unknown) => {
        if (cancelled) return;
        setState({ status: error instanceof StorageUnavailableError ? 'unavailable' : 'error' });
      },
    );
    return () => {
      cancelled = true;
      opened?.close();
    };
  }, [open, attempt]);

  const retry = () => {
    setAttempt((n) => n + 1);
  };

  if (state.status === 'unavailable') {
    return (
      <div className="async-problem" role="alert">
        <p>No pudimos abrir el almacenamiento de este dispositivo.</p>
        <p className="async-detail">
          Pasa en navegación privada o si el navegador bloquea los datos de los sitios. Sin
          almacenamiento, Constancia no puede guardar tus hábitos.
        </p>
        <button type="button" className="button" onClick={retry}>
          Reintentar
        </button>
      </div>
    );
  }
  if (state.status !== 'open') {
    return (
      <AsyncState status={state.status === 'error' ? 'error' : 'loading'} onRetry={retry}>
        {null}
      </AsyncState>
    );
  }
  return <DbContext value={state.db}>{children}</DbContext>;
}
