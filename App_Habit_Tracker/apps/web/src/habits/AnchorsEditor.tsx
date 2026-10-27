import { fieldErrors, type Anchor } from '@habit-tracker/shared';
import { useState } from 'react';
import { AnchorInUseError, anchorsRepo } from '../db/anchors-repo';
import { useDb } from '../db/DatabaseProvider';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';

interface Props {
  anchor: Anchor;
  first: boolean;
  last: boolean;
}

function AnchorRow({ anchor, first, last }: Props) {
  const repo = anchorsRepo(useDb());
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(anchor.name);
  const [problem, setProblem] = useState<string | null>(null);

  const rename = async () => {
    try {
      await repo.rename(anchor.id, name);
      setEditing(false);
      setProblem(null);
    } catch (error) {
      const fields = fieldErrors(error);
      if (!fields) throw error;
      setProblem(fields.name ?? null);
    }
  };

  const archive = async () => {
    try {
      await repo.archive(anchor.id);
    } catch (error) {
      if (!(error instanceof AnchorInUseError)) throw error;
      setProblem('Mueve sus hábitos a otra ancla primero.');
    }
  };

  return (
    <li className="row row-wrap" data-name={anchor.name}>
      {editing ? (
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void rename();
          }}
        >
          <input
            aria-label={`Nuevo nombre de ${anchor.name}`}
            value={name}
            maxLength={40}
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <button type="submit" className="button button-small button-primary">
            Guardar
          </button>
          <button
            type="button"
            className="button button-small"
            onClick={() => {
              setEditing(false);
              setName(anchor.name);
              setProblem(null);
            }}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <>
          <span className="row-title">{anchor.name}</span>
          <div className="row-actions">
            <button
              type="button"
              className="button button-small button-icon"
              aria-label={`Subir ${anchor.name}`}
              disabled={first}
              onClick={() => void repo.move(anchor.id, 'up')}
            >
              <span aria-hidden="true">↑</span>
            </button>
            <button
              type="button"
              className="button button-small button-icon"
              aria-label={`Bajar ${anchor.name}`}
              disabled={last}
              onClick={() => void repo.move(anchor.id, 'down')}
            >
              <span aria-hidden="true">↓</span>
            </button>
            <button
              type="button"
              className="button button-small"
              aria-label={`Renombrar ${anchor.name}`}
              onClick={() => {
                setEditing(true);
                setProblem(null);
              }}
            >
              Renombrar
            </button>
            <button
              type="button"
              className="button button-small"
              aria-label={`Archivar ${anchor.name}`}
              onClick={() => void archive()}
            >
              Archivar
            </button>
          </div>
        </>
      )}
      {problem === null ? null : (
        <p className="field-error row-full" role="alert">
          {problem}
        </p>
      )}
    </li>
  );
}

// Anchors group the habits on "Hoy". They are reordered with buttons, not by dragging,
// so it works the same with a screen reader.
export function AnchorsEditor() {
  const db = useDb();
  const repo = anchorsRepo(db);
  const query = useTimedLiveQuery(() => db.anchors.orderBy('sortOrder').toArray(), [db]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const live = (query.data ?? []).filter((anchor) => anchor.deletedAt === null);
  const active = live.filter((anchor) => anchor.archivedAt === null);
  const archived = live.filter((anchor) => anchor.archivedAt !== null);

  const add = async () => {
    try {
      await repo.create(newName);
      setNewName('');
      setProblem(null);
    } catch (error) {
      const fields = fieldErrors(error);
      if (!fields) throw error;
      setProblem(fields.name ?? null);
    }
  };

  return (
    <section className="group" aria-labelledby="anchors-title">
      <div className="group-header">
        <h2 id="anchors-title" className="group-title">
          Anclas
        </h2>
        <button
          type="button"
          className="button button-small"
          aria-expanded={open}
          aria-controls="anchors-editor"
          onClick={() => {
            setOpen((value) => !value);
          }}
        >
          {open ? 'Listo' : 'Editar anclas'}
        </button>
      </div>
      <AsyncState status={query.state} onRetry={query.retry}>
        {open ? null : (
          <p className="group-summary">{active.map((anchor) => anchor.name).join(' · ')}</p>
        )}
      </AsyncState>
      {open ? (
        <div id="anchors-editor">
          <ul className="rows" aria-label="Anclas activas">
            {active.map((anchor, index) => (
              <AnchorRow
                key={anchor.id}
                anchor={anchor}
                first={index === 0}
                last={index === active.length - 1}
              />
            ))}
          </ul>
          <form
            className="inline-form add-form"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <label htmlFor="new-anchor">Nueva ancla</label>
            <input
              id="new-anchor"
              value={newName}
              maxLength={40}
              autoComplete="off"
              onChange={(event) => {
                setNewName(event.target.value);
              }}
              {...(problem === null
                ? {}
                : { 'aria-invalid': true, 'aria-describedby': 'new-anchor-error' })}
            />
            <button type="submit" className="button button-small">
              Agregar
            </button>
            {problem === null ? null : (
              <p className="field-error row-full" id="new-anchor-error">
                {problem}
              </p>
            )}
          </form>
          {archived.length > 0 ? (
            <>
              <h3 className="subgroup-title">Archivadas</h3>
              <ul className="rows" aria-label="Anclas archivadas">
                {archived.map((anchor) => (
                  <li key={anchor.id} className="row row-archived">
                    <span className="row-title">{anchor.name}</span>
                    <button
                      type="button"
                      className="button button-small"
                      aria-label={`Reactivar ${anchor.name}`}
                      onClick={() => void repo.unarchive(anchor.id)}
                    >
                      Reactivar
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
