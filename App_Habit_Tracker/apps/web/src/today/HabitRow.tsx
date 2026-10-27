import type { LocalDate } from '@habit-tracker/shared';
import { useRef, useState } from 'react';
import { checkInsRepo } from '../db/check-ins-repo';
import { useDb } from '../db/DatabaseProvider';
import { habitStats } from './habit-stats';
import type { TodayRow } from './today-model';

// A second tap this soon after the last one is taken as part of the same gesture, so a
// double tap leaves the habit marked instead of marking and unmarking it (review focus 1).
export const TAP_GUARD_MS = 400;

interface Props {
  row: TodayRow;
  today: LocalDate;
  onMore: (button: HTMLButtonElement) => void;
}

export function HabitRow({ row, today, onMore }: Props) {
  const repo = checkInsRepo(useDb());
  const { habit, checkIn } = row;
  const savedDone = checkIn?.status === 'done';
  // A tap shows at once, until the saved check-in moves on from the version it was made on.
  const savedVersion = checkIn?.updatedAt ?? null;
  const [pending, setPending] = useState<{ done: boolean; base: string | null } | null>(null);
  const lastTap = useRef(-Infinity);
  const done = pending?.base === savedVersion ? pending.done : savedDone;

  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < TAP_GUARD_MS) return;
    lastTap.current = now;
    setPending({ done: !done, base: savedVersion });
    void (done ? repo.clear(habit.id, today) : repo.markDone(habit.id, today));
  };

  const detail = habitStats(row, today);

  return (
    <li
      className="habit"
      aria-label={habit.name}
      data-done={done}
      data-skipped={!done && checkIn?.status === 'skipped'}
    >
      <button type="button" className="habit-toggle" aria-pressed={done} onClick={tap}>
        <span className="check" aria-hidden="true" />
        <span className="habit-name">{habit.name}</span>
      </button>
      {detail === '' ? null : <p className="habit-detail">{detail}</p>}
      <button
        type="button"
        className="habit-more"
        aria-label={`Más opciones para ${habit.name}`}
        onClick={(event) => {
          onMore(event.currentTarget);
        }}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="4" cy="10" r="2" />
          <circle cx="10" cy="10" r="2" />
          <circle cx="16" cy="10" r="2" />
        </svg>
      </button>
    </li>
  );
}
