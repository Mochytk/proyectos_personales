import { formatShortDay, resolveStyle } from '@habit-tracker/shared';
import { Link } from 'react-router';
import { useToday } from '../app/useToday';
import { useDb } from '../db/DatabaseProvider';
import { useSettings } from '../settings/useSettings';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';
import { HabitRow } from './HabitRow';
import { StyleSignature } from './StyleSignature';
import { buildToday, type TodayData } from './today-model';

export function TodayScreen() {
  const db = useDb();
  const today = useToday();
  const style = resolveStyle(useSettings().style, today);
  const query = useTimedLiveQuery<TodayData>(async () => {
    const [habits, anchors, checkIns, overrides] = await Promise.all([
      db.habits.toArray(),
      db.anchors.toArray(),
      db.checkIns.toArray(),
      db.weeklyQuotaOverrides.toArray(),
    ]);
    return { habits, anchors, checkIns, overrides };
  }, [db]);
  const model = query.data ? buildToday(query.data, today) : null;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Hoy</h1>
        <p className="page-date">{formatShortDay(today)}</p>
      </div>
      <AsyncState
        status={query.state}
        onRetry={query.retry}
        isEmpty={model?.hasHabits === false}
        empty={
          <div className="empty">
            <p>Todavía no tienes hábitos.</p>
            <Link to="/habitos/nuevo" className="button button-primary">
              Crear hábito
            </Link>
          </div>
        }
      >
        {model ? (
          <>
            <StyleSignature style={style} model={model} />
            {model.groups.length === 0 ? (
              <p className="empty">Hoy no tienes hábitos programados.</p>
            ) : null}
            {model.groups.map((group) => (
              <section
                key={group.anchor.id}
                className="group"
                aria-label={group.anchor.name}
                data-color={group.colorIndex}
              >
                <h2 className="group-title">{group.anchor.name}</h2>
                <ul className="habits">
                  {group.rows.map((row) => (
                    <HabitRow key={row.habit.id} row={row} today={today} onMore={() => undefined} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : null}
      </AsyncState>
    </>
  );
}
