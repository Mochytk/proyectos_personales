import type { Anchor, Habit } from '@habit-tracker/shared';
import { Link } from 'react-router';
import { useDb } from '../db/DatabaseProvider';
import { habitsRepo } from '../db/habits-repo';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';
import { scheduleLabel } from './schedule-label';

interface Data {
  habits: Habit[];
  anchors: Anchor[];
}

function bySortOrder(a: { sortOrder: number }, b: { sortOrder: number }): number {
  return a.sortOrder - b.sortOrder;
}

export function HabitsScreen() {
  const db = useDb();
  const query = useTimedLiveQuery<Data>(async () => {
    const [habits, anchors] = await Promise.all([db.habits.toArray(), db.anchors.toArray()]);
    return { habits: habits.filter((habit) => habit.deletedAt === null), anchors };
  }, [db]);

  const habits = query.data?.habits ?? [];
  const anchors = (query.data?.anchors ?? []).slice().sort(bySortOrder);
  const active = habits.filter((habit) => habit.archivedAt === null).sort(bySortOrder);
  const archived = habits.filter((habit) => habit.archivedAt !== null).sort(bySortOrder);
  const repo = habitsRepo(db);

  // Habits under an anchor that sync removed have no group of their own; they go last.
  const groups = [
    ...anchors
      .filter((anchor) => anchor.deletedAt === null)
      .map((anchor) => ({
        id: anchor.id,
        name: anchor.name,
        habits: active.filter((habit) => habit.anchorId === anchor.id),
      })),
    {
      id: 'other',
      name: 'Sin ancla',
      habits: active.filter(
        (habit) => !anchors.some((a) => a.id === habit.anchorId && a.deletedAt === null),
      ),
    },
  ].filter((group) => group.habits.length > 0);

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Hábitos</h1>
        <Link to="/habitos/nuevo" className="button button-primary">
          Crear hábito
        </Link>
      </div>
      <AsyncState
        status={query.state}
        onRetry={query.retry}
        isEmpty={habits.length === 0}
        empty={
          <div className="empty">
            <p>Todavía no tienes hábitos.</p>
          </div>
        }
      >
        {groups.map((group) => (
          <section key={group.id} className="group" aria-labelledby={`group-${group.id}`}>
            <h2 id={`group-${group.id}`} className="group-title">
              {group.name}
            </h2>
            <ul className="rows">
              {group.habits.map((habit) => (
                <li key={habit.id} className="row">
                  <div className="row-text">
                    <span className="row-title">{habit.name}</span>
                    <span className="row-detail">{scheduleLabel(habit)}</span>
                  </div>
                  <div className="row-actions">
                    <Link
                      to={`/habitos/${habit.id}/editar`}
                      className="button button-small"
                      aria-label={`Editar ${habit.name}`}
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className="button button-small"
                      aria-label={`Archivar ${habit.name}`}
                      onClick={() => void repo.archive(habit.id)}
                    >
                      Archivar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {archived.length > 0 ? (
          <section className="group" aria-labelledby="group-archived">
            <h2 id="group-archived" className="group-title">
              Archivados
            </h2>
            <ul className="rows">
              {archived.map((habit) => (
                <li key={habit.id} className="row row-archived">
                  <div className="row-text">
                    <span className="row-title">{habit.name}</span>
                    <span className="row-detail">{scheduleLabel(habit)}</span>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      className="button button-small"
                      aria-label={`Reactivar ${habit.name}`}
                      onClick={() => void repo.unarchive(habit.id)}
                    >
                      Reactivar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </AsyncState>
    </>
  );
}
