import { addDays } from '../dates/calendar';
import type { LocalDate } from '../dates/local-date';
import type { CheckInStatus, Habit } from '../schemas/habits';
import { isScheduledOn } from './schedule';

export type HeatmapState =
  'done' | 'skipped' | 'missed' | 'not_scheduled' | 'before_start' | 'today_pending';

// The habit's history, one cell per day, oldest first and ending today (RF-1.5).
// A weekly quota can be met on any day, so its empty days are never "missed".
export function buildHeatmap(args: {
  habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>;
  today: LocalDate;
  checkIns: ReadonlyMap<LocalDate, CheckInStatus>;
  days?: number;
}): { date: LocalDate; state: HeatmapState }[] {
  const { habit, today, checkIns, days = 90 } = args;
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - days + 1);
    return { date, state: stateOf(habit, date, today, checkIns.get(date)) };
  });
}

function stateOf(
  habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>,
  date: LocalDate,
  today: LocalDate,
  status: CheckInStatus | undefined,
): HeatmapState {
  if (date < habit.startsOn) return 'before_start';
  if (status !== undefined) return status;
  if (!isScheduledOn(habit, date)) return 'not_scheduled';
  if (date === today) return 'today_pending';
  return habit.mode === 'weekly_quota' ? 'not_scheduled' : 'missed';
}
