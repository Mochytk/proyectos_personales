import { addDays } from '../dates/calendar';
import type { LocalDate } from '../dates/local-date';
import type { CheckInStatus, Habit } from '../schemas/habits';
import { isScheduledOn } from './schedule';
import { dailyStreak } from './streak';
import { weeklyProgress, weeklyStreak } from './weekly';

export interface HabitWeek {
  habitId: string;
  done: number;
  skipped: number;
  // Scheduled days that passed without a record. Only daily habits miss days: a weekly
  // quota can be met on any day.
  missed: number;
  quota: number | null;
  met: boolean | null;
  // At the end of the week, or as of today if the week is still running.
  streak: number;
}

// The Sunday review (RF-1.6): one line per active habit that had started by the end of
// the week. `today` keeps the current day, and the days after it, from counting as missed.
export function weekSummary(args: {
  habits: Pick<
    Habit,
    'id' | 'mode' | 'weeklyQuota' | 'weekdays' | 'startsOn' | 'archivedAt' | 'deletedAt'
  >[];
  weekStart: LocalDate;
  today: LocalDate;
  checkIns: ReadonlyMap<string, ReadonlyMap<LocalDate, CheckInStatus>>;
  overrides: ReadonlyMap<string, ReadonlyMap<LocalDate, number>>;
}): HabitWeek[] {
  const { habits, weekStart, today, checkIns, overrides } = args;
  const weekEnd = addDays(weekStart, 6);
  const closed = today > weekEnd;
  const lastDay = closed ? weekEnd : today;
  const empty = new Map<never, never>();
  // The streak rules treat "today" and "the current week" as still open. For a closed
  // week, ask them about the day and week right after it, with nothing recorded there,
  // so the reviewed week counts as finished.
  const asOfDay = closed ? addDays(weekEnd, 1) : today;
  const asOfWeek = closed ? addDays(weekStart, 7) : weekStart;
  const upToWeekEnd = <V>(entries: ReadonlyMap<LocalDate, V>): ReadonlyMap<LocalDate, V> =>
    closed ? new Map([...entries].filter(([date]) => date <= weekEnd)) : entries;

  return habits
    .filter((h) => h.archivedAt === null && h.deletedAt === null && h.startsOn <= weekEnd)
    .map((habit) => {
      const statuses = checkIns.get(habit.id) ?? empty;
      let done = 0;
      let skipped = 0;
      let missed = 0;
      for (let date = weekStart; date <= lastDay; date = addDays(date, 1)) {
        const status = statuses.get(date);
        if (status === 'done') done += 1;
        else if (status === 'skipped') skipped += 1;
        else if (habit.mode === 'daily' && date !== today && isScheduledOn(habit, date)) {
          missed += 1;
        }
      }

      if (habit.mode === 'daily') {
        const streak = dailyStreak({ habit, today: asOfDay, checkIns: upToWeekEnd(statuses) });
        return { habitId: habit.id, done, skipped, missed, quota: null, met: null, streak };
      }
      const habitOverrides = overrides.get(habit.id) ?? empty;
      const { quota, met } = weeklyProgress({
        habit,
        weekStart,
        checkIns: statuses,
        overrides: habitOverrides,
      });
      const streak = weeklyStreak({
        habit,
        currentWeekStart: asOfWeek,
        checkIns: upToWeekEnd(statuses),
        overrides: habitOverrides,
      });
      return { habitId: habit.id, done, skipped, missed, quota, met, streak };
    });
}
