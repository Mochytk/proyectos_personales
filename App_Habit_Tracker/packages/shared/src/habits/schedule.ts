import { isoWeekday } from '../dates/calendar';
import type { LocalDate } from '../dates/local-date';
import type { Anchor, Habit } from '../schemas/habits';

export function isScheduledOn(
  habit: Pick<Habit, 'mode' | 'weekdays' | 'startsOn'>,
  date: LocalDate,
): boolean {
  // YYYY-MM-DD strings compare in calendar order.
  if (date < habit.startsOn) return false;
  // A weekly quota can be met on any day, so it shows every day of the week.
  return habit.mode === 'weekly_quota' || habit.weekdays.includes(isoWeekday(date));
}

// The "Hoy" list: active habits for the day, grouped by anchor in display order.
// An archived anchor still groups its habits; only a deleted one disappears.
export function habitsForDay(
  habits: Habit[],
  anchors: Anchor[],
  date: LocalDate,
): { anchor: Anchor; habits: Habit[] }[] {
  const active = habits.filter(
    (habit) => habit.archivedAt === null && habit.deletedAt === null && isScheduledOn(habit, date),
  );
  return anchors
    .filter((anchor) => anchor.deletedAt === null)
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .map((anchor) => ({
      anchor,
      habits: active
        .filter((habit) => habit.anchorId === anchor.id)
        .toSorted((a, b) => a.sortOrder - b.sortOrder),
    }))
    .filter((group) => group.habits.length > 0);
}
