import { addDays } from '../dates/calendar';
import type { LocalDate } from '../dates/local-date';
import type { CheckInStatus, Habit } from '../schemas/habits';
import { isScheduledOn } from './schedule';

// RF-1.3, for daily habits: consecutive scheduled days with "done", walking back from today.
// "skipped" neither adds nor breaks; a past scheduled day with no check-in breaks;
// today with no check-in yet does not break, since the day is not over.
export function dailyStreak(args: {
  habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>;
  today: LocalDate;
  checkIns: ReadonlyMap<LocalDate, CheckInStatus>;
}): number {
  const { habit, today, checkIns } = args;
  let streak = 0;
  for (let date = today; date >= habit.startsOn; date = addDays(date, -1)) {
    if (!isScheduledOn(habit, date)) continue;
    const status = checkIns.get(date);
    if (status === 'done') streak += 1;
    else if (status === undefined && date !== today) break;
  }
  return streak;
}
