import { mediaTypeLabelsES } from '../constants/mediaTypes';
import { MEDIA_TYPES, STATUSES } from './enums';
import type { MediaItem, MediaType, SmartFilters } from './useStore';

/** Options offered for "not touched for at least N days". */
export const STALE_DAY_OPTIONS = [7, 30, 90] as const;

const DAY_MS = 86_400_000;
const MAX_TAGS = 20;

export const statusLabelsES: Record<MediaItem['status'], string> = {
  unstarted: 'Por empezar',
  in_progress: 'En curso',
  completed: 'Terminado',
  abandoned: 'Abandonado',
};

/** Cleans filters read from storage or a backup; unknown or invalid values are dropped. */
export function sanitizeSmartFilters(raw: unknown): SmartFilters | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const filters: SmartFilters = {};

  const types = [...new Set((Array.isArray(src.types) ? src.types : []).filter((t): t is MediaType => MEDIA_TYPES.includes(t as MediaType)))];
  if (types.length > 0) filters.types = types;

  const statuses = [...new Set((Array.isArray(src.statuses) ? src.statuses : []).filter((x): x is MediaItem['status'] => STATUSES.includes(x as MediaItem['status'])))];
  if (statuses.length > 0) filters.statuses = statuses;

  if (typeof src.minRating === 'number' && Number.isFinite(src.minRating)) {
    const stars = Math.round(src.minRating);
    if (stars >= 1 && stars <= 5) filters.minRating = stars;
  }

  const tags = Array.isArray(src.tags)
    ? [...new Set(src.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter(Boolean))].slice(0, MAX_TAGS)
    : [];
  if (tags.length > 0) filters.tags = tags;

  if (typeof src.staleDays === 'number' && Number.isInteger(src.staleDays) && src.staleDays >= 1 && src.staleDays <= 3650) {
    filters.staleDays = src.staleDays;
  }
  return filters;
}

/**
 * Whether an item belongs in a smart list. Every filter that is set must match; with none set, an
 * item matches unless it is finished, which is how smart lists have always behaved.
 */
export function matchesSmartFilters(item: MediaItem, filters: SmartFilters | undefined, now: number = Date.now()): boolean {
  const f = filters ?? {};
  if (f.statuses && f.statuses.length > 0 ? !f.statuses.includes(item.status) : item.status === 'completed') return false;
  if (f.types && f.types.length > 0 && !f.types.includes(item.type)) return false;
  if (f.minRating !== undefined && (item.rating ?? 0) < f.minRating) return false;
  if (f.tags && f.tags.length > 0) {
    const own = new Set((item.tags ?? []).map((t) => t.toLowerCase()));
    if (!f.tags.some((t) => own.has(t.toLowerCase()))) return false;
  }
  if (f.staleDays !== undefined && now - item.updatedAt < f.staleDays * DAY_MS) return false;
  return true;
}

export const matchingItems = (items: MediaItem[], filters: SmartFilters | undefined, now: number = Date.now()): MediaItem[] =>
  items.filter((item) => matchesSmartFilters(item, filters, now));

/** Short phrases describing the filters, for the list banner. */
export function describeFilters(filters: SmartFilters | undefined): string[] {
  const f = filters ?? {};
  const parts: string[] = [];
  if (f.types && f.types.length > 0) parts.push(f.types.map((t) => mediaTypeLabelsES[t] ?? t).join(', '));
  if (f.statuses && f.statuses.length > 0) parts.push(f.statuses.map((s) => statusLabelsES[s]).join(', '));
  if (f.minRating !== undefined) parts.push(`${'★'.repeat(f.minRating)} o más`);
  if (f.tags && f.tags.length > 0) parts.push(f.tags.map((t) => `#${t}`).join(' '));
  if (f.staleDays !== undefined) parts.push(`Sin tocar hace ${f.staleDays} días o más`);
  return parts.length > 0 ? parts : ['Todo lo pendiente'];
}

/** Adds `value` to `list`, or removes it if it is already there. */
export const toggleValue = <T,>(list: readonly T[] | undefined, value: T): T[] => {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
};

/** Tags in use, most used first (then alphabetical), one entry per spelling ignoring case. */
export function collectTags(items: MediaItem[]): string[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const item of items) {
    for (const tag of item.tags ?? []) {
      const clean = tag.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      const entry = counts.get(key);
      counts.set(key, { name: entry?.name ?? clean, count: (entry?.count ?? 0) + 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).map((e) => e.name);
}
