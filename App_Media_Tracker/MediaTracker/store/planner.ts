import { DayBucket, bucketFor } from './dates';
import { NextEpisodeInfo, airDateTimestamp, upcomingEpisode } from './seasons';
import type { MediaItem } from './useStore';

export interface PlannerEntry {
  item: MediaItem;
  /** When it happens; undefined for tasks and events without a date. */
  date?: number;
  hasTime: boolean;
  /** Set when the entry comes from a series' announced next episode rather than a due date. */
  premiere?: NextEpisodeInfo;
}

export const BUCKET_ORDER: DayBucket[] = ['overdue', 'today', 'tomorrow', 'week', 'later', 'undated'];

/**
 * What the Planner lists: unfinished items with a due date, tasks and events (dated or not),
 * and series whose next episode is still to air. A due date set by the user wins over the air date.
 */
export function buildPlannerEntries(items: MediaItem[], now: number = Date.now()): PlannerEntry[] {
  const entries: PlannerEntry[] = [];
  for (const item of items) {
    if (item.status === 'completed') continue;
    const premiere = item.dueDate === undefined && item.type === 'tv_show' ? upcomingEpisode(item.nextEpisode, now) : undefined;
    const date = item.dueDate ?? (premiere ? airDateTimestamp(premiere.date) : undefined);
    if (date === undefined && item.type !== 'event' && item.type !== 'task') continue;
    entries.push({ item, date, hasTime: item.dueHasTime === true, premiere });
  }
  return entries.sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity) || a.item.updatedAt - b.item.updatedAt);
}

/** Groups entries by day bucket, in display order, omitting empty buckets. */
export function groupEntries(entries: PlannerEntry[], now: number = Date.now()): { key: DayBucket; entries: PlannerEntry[] }[] {
  return BUCKET_ORDER
    .map((key) => ({ key, entries: entries.filter((e) => bucketFor({ dueDate: e.date, dueHasTime: e.hasTime }, now) === key) }))
    .filter((group) => group.entries.length > 0);
}
