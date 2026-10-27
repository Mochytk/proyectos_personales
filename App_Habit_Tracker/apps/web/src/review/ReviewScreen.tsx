import {
  addDays,
  effectiveQuota,
  formatDisplayDate,
  isoWeekday,
  toLocalDate,
  weekStart as weekStartOf,
  weekSummary,
  type CheckIn,
  type CheckInStatus,
  type Habit,
  type HabitWeek,
  type LocalDate,
  type WeeklyQuotaOverride,
  type WeeklyReview,
} from '@habit-tracker/shared';
import { useState } from 'react';
import { Link } from 'react-router';
import { useToday } from '../app/useToday';
import { useDb } from '../db/DatabaseProvider';
import { reviewsRepo } from '../db/reviews-repo';
import { useSettings } from '../settings/useSettings';
import { AsyncState } from '../ui/AsyncState';
import { useTimedLiveQuery } from '../ui/useTimedLiveQuery';

interface Data {
  habits: Habit[];
  checkIns: CheckIn[];
  overrides: WeeklyQuotaOverride[];
  review: WeeklyReview | undefined;
}

const QUOTAS = [0, 1, 2, 3, 4, 5, 6, 7];

// On Sunday the review covers the week in progress; on other days, the last closed week.
export function reviewedWeek(today: LocalDate): LocalDate {
  const current = weekStartOf(today);
  return isoWeekday(today) === 7 ? current : addDays(current, -7);
}

// Groups live rows by habit, then by date or week: the shape the shared rules take.
function byHabit<T extends { habitId: string; deletedAt: string | null }, V>(
  rows: T[],
  entry: (row: T) => [LocalDate, V],
): Map<string, Map<LocalDate, V>> {
  const map = new Map<string, Map<LocalDate, V>>();
  for (const row of rows) {
    if (row.deletedAt !== null) continue;
    const inner = map.get(row.habitId) ?? new Map<LocalDate, V>();
    inner.set(...entry(row));
    map.set(row.habitId, inner);
  }
  return map;
}

function count(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

function summaryText(line: HabitWeek): string {
  const parts =
    line.quota === null
      ? [
          count(line.done, 'hecho', 'hechos'),
          count(line.skipped, 'saltado', 'saltados'),
          `${String(line.missed)} sin hacer`,
        ]
      : [
          `${String(line.done)} de ${String(line.quota)}`,
          line.quota === 0 ? 'En pausa' : line.met ? 'Cumplido' : 'No cumplido',
        ];
  if (line.streak > 0) {
    const [one, many] = line.quota === null ? ['día', 'días'] : ['semana', 'semanas'];
    parts.push(`Racha: ${count(line.streak, one, many)}`);
  }
  return parts.join(' · ');
}

function shortDate(date: LocalDate): string {
  return formatDisplayDate(date).slice(0, 5);
}

export function ReviewScreen() {
  const db = useDb();
  const today = useToday();
  const settings = useSettings();
  const week = reviewedWeek(today);
  const nextWeek = addDays(week, 7);
  const repo = reviewsRepo(db);

  const query = useTimedLiveQuery<Data>(async () => {
    const [habits, checkIns, overrides, review] = await Promise.all([
      db.habits.toArray(),
      db.checkIns.toArray(),
      db.weeklyQuotaOverrides.toArray(),
      db.weeklyReviews.where('weekStart').equals(week).first(),
    ]);
    return { habits, checkIns, overrides, review };
  }, [db, week]);

  const data = query.data;
  const checkIns = byHabit(data?.checkIns ?? [], (c): [LocalDate, CheckInStatus] => [
    c.localDate,
    c.status,
  ]);
  const overrides = byHabit(data?.overrides ?? [], (o): [LocalDate, number] => [
    o.weekStart,
    o.quota,
  ]);
  const habits = (data?.habits ?? []).toSorted((a, b) => a.sortOrder - b.sortOrder);
  const lines = weekSummary({ habits, weekStart: week, today, checkIns, overrides });
  const byId = new Map(habits.map((habit) => [habit.id, habit]));
  const quotaHabits = habits.filter(
    (h) => h.mode === 'weekly_quota' && h.archivedAt === null && h.deletedAt === null,
  );
  const review = data?.review;

  return (
    <>
      <h1 className="page-title">Revisión</h1>
      <p className="page-subtitle">{`Semana del ${shortDate(week)} al ${formatDisplayDate(addDays(week, 6))}`}</p>
      <AsyncState
        status={query.state}
        onRetry={query.retry}
        isEmpty={lines.length === 0}
        empty={
          <div className="empty">
            <p>No hay hábitos que revisar en esta semana.</p>
            <Link to="/habitos/nuevo" className="button button-primary">
              Crear hábito
            </Link>
          </div>
        }
      >
        <section className="group" aria-labelledby="review-habits">
          <h2 id="review-habits" className="group-title">
            Cómo te fue
          </h2>
          <ul className="rows">
            {lines.map((line) => {
              const name = byId.get(line.habitId)?.name ?? '';
              return (
                <li key={line.habitId} className="row" aria-label={name}>
                  <div className="row-text">
                    <span className="row-title">{name}</span>
                    <span className="row-detail">{summaryText(line)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {quotaHabits.length > 0 ? (
          <section className="group" aria-labelledby="review-quotas">
            <h2 id="review-quotas" className="group-title">
              {`Cuotas de la semana del ${shortDate(nextWeek)}`}
            </h2>
            <p className="field-note">0 deja la semana en pausa: no suma ni corta la racha.</p>
            <div className="form">
              {quotaHabits.map((habit) => {
                const quota = effectiveQuota(habit, nextWeek, overrides.get(habit.id) ?? new Map());
                const id = `quota-${habit.id}`;
                return (
                  <div key={habit.id} className="field">
                    <label
                      htmlFor={id}
                    >{`${habit.name}: veces la semana del ${shortDate(nextWeek)}`}</label>
                    <select
                      id={id}
                      value={quota}
                      onChange={(event) => {
                        void repo.setQuota(habit.id, nextWeek, Number(event.target.value));
                      }}
                    >
                      {QUOTAS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="group" aria-labelledby="review-reflection">
          <h2 id="review-reflection" className="group-title">
            Reflexión
          </h2>
          <Reflection
            key={week}
            initial={review?.reflection ?? ''}
            onSave={(text) => repo.saveReflection(week, text)}
          />
        </section>

        <div className="form-actions review-done">
          {review?.completedAt ? (
            <p role="status">
              {`Revisión hecha el ${formatDisplayDate(
                toLocalDate(
                  new Date(review.completedAt),
                  settings.timeZone,
                  settings.dayCutoffHour,
                ),
              )}.`}
            </p>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => void repo.complete(week)}
            >
              Marcar revisión como hecha
            </button>
          )}
        </div>
      </AsyncState>
    </>
  );
}

function Reflection({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(text).then(() => {
          setSaved(true);
        });
      }}
    >
      <div className="field">
        <label htmlFor="reflection">Reflexión de la semana (opcional)</label>
        <textarea
          id="reflection"
          value={text}
          maxLength={2000}
          rows={4}
          onChange={(event) => {
            setText(event.target.value);
            setSaved(false);
          }}
        />
        {saved ? (
          <p className="field-note" role="status">
            Guardada.
          </p>
        ) : null}
      </div>
      <div className="form-actions">
        <button type="submit" className="button">
          Guardar reflexión
        </button>
      </div>
    </form>
  );
}
