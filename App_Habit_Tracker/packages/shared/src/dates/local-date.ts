// A calendar day in the user's time zone, written as YYYY-MM-DD (ADR 0007).
// Branded so a plain string cannot be passed where a validated date is expected.
export type LocalDate = string & { readonly __brand: 'LocalDate' };

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;
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
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Intl.DateTimeFormat returned no ${type} part`);
    return Number(part.value);
  };
  // Calendar arithmetic in UTC, where every day lasts exactly 24 hours.
  let dayStart = Date.UTC(read('year'), read('month') - 1, read('day'));
  if (read('hour') < cutoffHour) dayStart -= DAY_MS;
  return new Date(dayStart).toISOString().slice(0, 10) as LocalDate;
}
