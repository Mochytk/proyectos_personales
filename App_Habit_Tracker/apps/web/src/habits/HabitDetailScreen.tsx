import type { CheckIn, Habit } from '@habit-tracker/shared';
import { Link, useParams } from 'react-router';
import { useToday } from '../app/useToday';
import { useDb } from '../db/DatabaseProvider';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';
import { HabitHistory } from './HabitHistory';
import { scheduleLabel } from './schedule-label';

interface Data {
  habit: Habit | undefined;
  checkIns: CheckIn[];
}

export function HabitDetailScreen() {
  const { id = '' } = useParams();
  const db = useDb();
  const today = useToday();
  const query = useTimedLiveQuery<Data>(async () => {
    const [habit, checkIns] = await Promise.all([
      db.habits.get(id),
      db.checkIns.where('habitId').equals(id).toArray(),
    ]);
    return { habit: habit?.deletedAt === null ? habit : undefined, checkIns };
  }, [db, id]);
  const habit = query.data?.habit;

  return (
    <AsyncState
      status={query.state}
      onRetry={query.retry}
      isEmpty={habit === undefined}
      empty={
        <div className="empty">
          <h1 className="page-title">Hábito</h1>
          <p>No encontramos este hábito.</p>
          <Link to="/habitos" className="button">
            Volver a Hábitos
          </Link>
        </div>
      }
    >
      {habit ? (
        <>
          <div className="page-header">
            <h1 className="page-title">{habit.name}</h1>
            <Link to={`/habitos/${habit.id}/editar`} className="button button-small">
              Editar
            </Link>
          </div>
          <p className="page-subtitle">
            {scheduleLabel(habit)}
            {habit.archivedAt === null ? '' : ' · Archivado'}
          </p>
          {habit.description === null ? null : <p>{habit.description}</p>}
          <section className="group" aria-labelledby="history-title">
            <h2 id="history-title" className="group-title">
              Últimos 90 días
            </h2>
            <HabitHistory habit={habit} today={today} checkIns={query.data?.checkIns ?? []} />
          </section>
        </>
      ) : null}
    </AsyncState>
  );
}
