import type { MediaItem } from './useStore';

/** Hour of the day (local time) at which a date-only reminder fires. */
export const DEFAULT_REMINDER_HOUR = 9;

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" in local time, for <input type="date"> and text fields. */
export function toDateInput(ts?: number): string {
  if (ts === undefined) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "HH:MM" in local time, for <input type="time">. */
export function toTimeInput(ts?: number, hasTime?: boolean): string {
  if (ts === undefined || !hasTime) return '';
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Builds a local timestamp from "YYYY-MM-DD" and an optional "HH:MM".
 * (Date.parse would read the date as UTC and show the previous day in negative-offset timezones.)
 * Returns undefined when the date is empty or invalid.
 */
export function fromInputs(date: string, time: string): { dueDate: number; dueHasTime: boolean } | undefined {
  const dm = date.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!dm) return undefined;
  const tm = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  const hasTime = !!tm && Number(tm[1]) < 24 && Number(tm[2]) < 60;
  const d = new Date(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]), hasTime ? Number(tm![1]) : 0, hasTime ? Number(tm![2]) : 0);
  // Reject rollovers such as 2026-02-31.
  if (isNaN(d.getTime()) || d.getMonth() !== Number(dm[2]) - 1) return undefined;
  return { dueDate: d.getTime(), dueHasTime: hasTime };
}

/** When the reminder for this item should fire, or undefined if it has none. */
export function reminderTime(item: Pick<MediaItem, 'dueDate' | 'dueHasTime' | 'remind'>): number | undefined {
  if (!item.remind || item.dueDate === undefined) return undefined;
  if (item.dueHasTime) return item.dueDate;
  const d = new Date(item.dueDate);
  d.setHours(DEFAULT_REMINDER_HOUR, 0, 0, 0);
  return d.getTime();
}

export type DayBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'undated';

const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Groups an item's due date relative to `now`. A date-only item is overdue only after its day ends. */
export function bucketFor(item: Pick<MediaItem, 'dueDate' | 'dueHasTime'>, now: number = Date.now()): DayBucket {
  if (item.dueDate === undefined) return 'undated';
  const today = startOfDay(now);
  const dueDay = startOfDay(item.dueDate);
  const dayDiff = Math.round((dueDay - today) / 86_400_000);
  if (dayDiff < 0) return 'overdue';
  if (dayDiff === 0) return item.dueHasTime && item.dueDate < now ? 'overdue' : 'today';
  if (dayDiff === 1) return 'tomorrow';
  if (dayDiff <= 7) return 'week';
  return 'later';
}
