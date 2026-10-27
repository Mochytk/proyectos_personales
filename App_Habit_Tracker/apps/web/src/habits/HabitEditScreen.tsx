import type { Anchor, Habit } from '@habit-tracker/shared';
import { Link, useNavigate, useParams } from 'react-router';
import { useToday } from '../app/useToday';
import { useDb } from '../db/DatabaseProvider';
import { habitsRepo } from '../db/habits-repo';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';
import { HabitForm, type HabitValues } from './HabitForm';

interface Data {
  habit: Habit | undefined;
  anchors: Anchor[];
  hasCheckIns: boolean;
}

// Creates a habit at /habitos/nuevo and edits one at /habitos/:id/editar.
export function HabitEditScreen() {
  const { id } = useParams();
  const db = useDb();
  const today = useToday();
  const navigate = useNavigate();

  const query = useTimedLiveQuery<Data>(async () => {
    const [habit, anchors, checkIns] = await Promise.all([
      id === undefined ? undefined : db.habits.get(id),
      db.anchors.orderBy('sortOrder').toArray(),
      id === undefined
        ? 0
        : db.checkIns
            .where('habitId')
            .equals(id)
            .filter((checkIn) => checkIn.deletedAt === null)
            .count(),
    ]);
    // Only live anchors can be chosen, plus the habit's own one if it was archived since.
    const choices = anchors.filter(
      (anchor) =>
        anchor.deletedAt === null && (anchor.archivedAt === null || anchor.id === habit?.anchorId),
    );
    return { habit, anchors: choices, hasCheckIns: checkIns > 0 };
  }, [db, id]);

  const save = async (values: HabitValues) => {
    const repo = habitsRepo(db);
    if (id === undefined) {
      await repo.create({ ...values, startsOn: today, color: 'default', icon: null });
    } else {
      await repo.update(id, values);
    }
    await navigate('/habitos');
  };

  const missing = id !== undefined && query.data?.habit === undefined;

  return (
    <>
      <h1 className="page-title">{id === undefined ? 'Nuevo hábito' : 'Editar hábito'}</h1>
      <AsyncState
        status={query.state}
        onRetry={query.retry}
        isEmpty={missing}
        empty={
          <div className="empty">
            <p>No encontramos este hábito.</p>
            <Link to="/habitos" className="button">
              Volver a Hábitos
            </Link>
          </div>
        }
      >
        {query.data ? (
          <HabitForm
            habit={query.data.habit}
            anchors={query.data.anchors}
            hasCheckIns={query.data.hasCheckIns}
            onSave={save}
          />
        ) : null}
      </AsyncState>
    </>
  );
}
