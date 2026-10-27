import { formatShortDay, resolveStyle } from '@habit-tracker/shared';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useToday } from '../app/useToday';
import { checkInsRepo } from '../db/check-ins-repo';
import { useDb } from '../db/DatabaseProvider';
import { useSettings } from '../settings/useSettings';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';
import { HabitRow } from './HabitRow';
import { SkipSheet } from './SkipSheet';
import { StyleSignature } from './StyleSignature';
import { buildToday, isResolved, type TodayData } from './today-model';

type Sheet = { kind: 'habit'; habitId: string } | { kind: 'day' } | null;

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
  const [sheet, setSheet] = useState<Sheet>(null);
  const opener = useRef<HTMLElement | null>(null);
  const repo = checkInsRepo(db);

  const rows = model?.groups.flatMap((group) => group.rows) ?? [];
  const pendingIds = rows.filter((row) => !isResolved(row)).map((row) => row.habit.id);
  const sheetRow = sheet?.kind === 'habit' ? rows.find((r) => r.habit.id === sheet.habitId) : null;

  const openSheet = (next: Sheet, button: HTMLElement) => {
    opener.current = button;
    setSheet(next);
  };
  const closeSheet = () => {
    setSheet(null);
    opener.current?.focus();
  };

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
            {model.groups.length > 0 ? (
              <button
                type="button"
                className="button button-small pause-day"
                disabled={pendingIds.length === 0}
                onClick={(event) => {
                  openSheet({ kind: 'day' }, event.currentTarget);
                }}
              >
                Pausar el día
              </button>
            ) : null}
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
                    <HabitRow
                      key={row.habit.id}
                      row={row}
                      today={today}
                      onMore={(button) => {
                        openSheet({ kind: 'habit', habitId: row.habit.id }, button);
                      }}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : null}
      </AsyncState>
      {sheet?.kind === 'day' ? (
        <SkipSheet
          title="Pausar el día"
          withNote={false}
          onSkip={(reason) => repo.pauseDay(today, reason, pendingIds)}
          onClose={closeSheet}
        />
      ) : null}
      {sheetRow ? (
        <SkipSheet
          title={`Saltar ${sheetRow.habit.name}`}
          withNote
          onSkip={(reason, note) => repo.skip(sheetRow.habit.id, today, reason, note)}
          onClear={sheetRow.checkIn ? () => repo.clear(sheetRow.habit.id, today) : undefined}
          onClose={closeSheet}
        />
      ) : null}
    </>
  );
}
