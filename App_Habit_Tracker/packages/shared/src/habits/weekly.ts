import { addDays, weekStart as weekStartOf } from '../dates/calendar';
import type { LocalDate } from '../dates/local-date';
import type { CheckInStatus, Habit } from '../schemas/habits';

// The quota for a given week: the Sunday review's override if there is one (RF-1.4),
// otherwise the habit's own quota.
export function effectiveQuota(
  habit: Pick<Habit, 'weeklyQuota'>,
  weekStart: LocalDate,
  overrides: ReadonlyMap<LocalDate, number>,
): number {
  return overrides.get(weekStart) ?? habit.weeklyQuota ?? 0;
}

export function weeklyProgress(args: {
  habit: Pick<Habit, 'weeklyQuota'>;
  weekStart: LocalDate;
  checkIns: ReadonlyMap<LocalDate, CheckInStatus>;
  overrides: ReadonlyMap<LocalDate, number>;
}): { done: number; quota: number; met: boolean } {
  const { habit, weekStart, checkIns, overrides } = args;
  let done = 0;
  for (let offset = 0; offset < 7; offset++) {
    if (checkIns.get(addDays(weekStart, offset)) === 'done') done += 1;
  }
  const quota = effectiveQuota(habit, weekStart, overrides);
  return { done, quota, met: done >= quota };
}

// Consecutive weeks that met the quota, plus the current one once it is met.
// A paused week (quota 0) neither adds nor breaks; the habit's first, partial week
// adds if met and is otherwise ignored.
export function weeklyStreak(args: {
  habit: Pick<Habit, 'weeklyQuota' | 'startsOn'>;
  currentWeekStart: LocalDate;
  checkIns: ReadonlyMap<LocalDate, CheckInStatus>;
  overrides: ReadonlyMap<LocalDate, number>;
}): number {
  const { habit, currentWeekStart, checkIns, overrides } = args;
  const firstWeek = weekStartOf(habit.startsOn);
  let streak = 0;
  for (let week = currentWeekStart; week >= firstWeek; week = addDays(week, -7)) {
    const { quota, met } = weeklyProgress({ habit, weekStart: week, checkIns, overrides });
    if (quota === 0) continue;
    if (met) streak += 1;
    else if (week !== currentWeekStart && week !== firstWeek) break;
  }
  return streak;
}
