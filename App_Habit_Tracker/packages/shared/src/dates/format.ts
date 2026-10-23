import { isoWeekday } from './calendar';
import type { LocalDate } from './local-date';

// A fixed list instead of Intl: its es-CL output ("vie.") varies between engines.
const SHORT_WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] as const;

function parts(date: LocalDate): { year: string; month: string; day: string } {
  return { year: date.slice(0, 4), month: date.slice(5, 7), day: date.slice(8, 10) };
}

export function formatDisplayDate(date: LocalDate): string {
  const { year, month, day } = parts(date);
  return `${day}-${month}-${year}`;
}

export function formatShortDay(date: LocalDate): string {
  const { month, day } = parts(date);
  return `${SHORT_WEEKDAYS[isoWeekday(date) - 1] ?? ''} ${day}-${month}`;
}
