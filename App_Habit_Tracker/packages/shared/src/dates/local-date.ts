import { addDays } from './calendar';

// A calendar day in the user's time zone, written as YYYY-MM-DD (ADR 0007).
// Branded so a plain string cannot be passed where a validated date is expected.
export type LocalDate = string & { readonly __brand: 'LocalDate' };

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_CUTOFF_HOUR = 6;

export function parseLocalDate(value: string): LocalDate {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new RangeError(`Not a YYYY-MM-DD date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
  if (!isRealDate) throw new RangeError(`Not a real calendar date: ${value}`);
  return value as LocalDate;
}

// The day an instant belongs to for the user: before `cutoffHour` (local time)
// it still counts as the previous day, so a habit checked at 00:40 lands on "yesterday".
export function toLocalDate(instant: Date, timeZone: string, cutoffHour: number): LocalDate {
  if (!Number.isInteger(cutoffHour) || cutoffHour < 0 || cutoffHour > MAX_CUTOFF_HOUR) {
    throw new RangeError(`cutoffHour must be an integer from 0 to ${String(MAX_CUTOFF_HOUR)}`);
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): string => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl.DateTimeFormat returned no ${type} part`);
    return part.value;
  };
  const calendarDay = `${read('year')}-${read('month')}-${read('day')}` as LocalDate;
  // A calendar day back, not 24 hours back, so DST days of 23 or 25 hours do not matter.
  return Number(read('hour')) < cutoffHour ? addDays(calendarDay, -1) : calendarDay;
}
