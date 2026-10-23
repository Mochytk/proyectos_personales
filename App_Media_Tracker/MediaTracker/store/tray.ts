import { PAGE_STEP, PERCENT_STEP, progressText } from './progress';
import { formatPosition, hasSeasonSplit, nextToWatch } from './seasons';
import type { MediaItem } from './useStore';

export const TRAY_MAX_ENTRIES = 8;
export const TRAY_TEXT_MAX = 80;

export interface Advance {
  updates: { currentCheckpoint: number; status: 'in_progress' };
  /** What the menu action says, e.g. "Visto T3 · E5" or "+10 páginas". */
  label: string;
}

const UNIT_ES: Record<string, string> = { episodes: 'episodio', chapters: 'capítulo', levels: 'nivel' };

/**
 * The next step for an item, as the menu bar offers it, or null when it cannot advance (no
 * counter, or already at the end). Advancing never marks an item finished.
 */
export function advanceProgress(item: MediaItem): Advance | null {
  const percentage = item.checkpointType === 'percentage';
  const total = percentage ? (item.totalCheckpoints || 100) : (item.totalCheckpoints || 0);
  const current = item.currentCheckpoint || 0;
  if (total <= 0 || current >= total) return null;

  if (hasSeasonSplit(item)) {
    const next = nextToWatch(current, item.seasons);
    return next ? { updates: { currentCheckpoint: current + 1, status: 'in_progress' }, label: `Visto ${formatPosition(next)}` } : null;
  }

  const step = percentage ? PERCENT_STEP : item.checkpointType === 'pages' ? PAGE_STEP : 1;
  const label = percentage
    ? `+${PERCENT_STEP} %`
    : item.checkpointType === 'pages'
      ? `+${PAGE_STEP} páginas`
      : `+1 ${UNIT_ES[item.checkpointType ?? ''] ?? 'paso'}`;
  return { updates: { currentCheckpoint: Math.min(total, current + step), status: 'in_progress' }, label };
}

/** What the Disfrutando tab lists: unfinished items in progress or with some progress. */
export const selectEnjoying = (items: MediaItem[]): MediaItem[] =>
  items.filter((item) =>
    item.status !== 'completed' &&
    (item.status === 'in_progress' || (item.currentCheckpoint && item.currentCheckpoint > 0) || item.progress > 0),
  );

export interface TrayEntry {
  id: string;
  title: string;
  label: string;
  advanceLabel?: string;
}

export interface TraySnapshot {
  entries: TrayEntry[];
  hasMore: boolean;
}

/** Cuts text to `max` characters, ending in "…", without splitting emoji or accented letters. */
function truncate(text: string, max: number): string {
  const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : undefined;
  const parts = segmenter ? Array.from(segmenter.segment(text), (p) => p.segment) : Array.from(text);
  return parts.length <= max ? text : `${parts.slice(0, max - 1).join('')}…`;
}

/** The text the menu bar shows: plain strings only, so the main process never needs the data itself. */
export function buildTraySnapshot(items: MediaItem[]): TraySnapshot {
  const enjoying = [...selectEnjoying(items)].sort((a, b) => b.updatedAt - a.updatedAt);
  const entries = enjoying.slice(0, TRAY_MAX_ENTRIES).map((item): TrayEntry => {
    const advance = advanceProgress(item);
    const label = item.checkpointType === 'percentage' ? `${item.currentCheckpoint || 0}%` : (progressText(item) ?? 'En curso');
    return {
      id: item.id,
      title: item.title.trim() ? truncate(item.title.trim(), TRAY_TEXT_MAX) : 'Sin título',
      label,
      ...(advance ? { advanceLabel: advance.label } : {}),
    };
  });
  return { entries, hasMore: enjoying.length > TRAY_MAX_ENTRIES };
}

export type TrayAction = { kind: 'advance' | 'open'; id: string } | { kind: 'open-enjoying' };

export type ResolvedTrayAction =
  | { type: 'advance'; id: string; updates: Advance['updates'] }
  | { type: 'open'; id: string }
  | { type: 'open-enjoying' };

/**
 * Turns an action coming back from the menu into something to do, or null when it should be
 * ignored: unknown actions, items deleted or no longer in Disfrutando since the menu was built,
 * items already at their end.
 */
export function resolveTrayAction(action: unknown, items: MediaItem[]): ResolvedTrayAction | null {
  if (typeof action !== 'object' || action === null) return null;
  const { kind, id } = action as { kind?: unknown; id?: unknown };
  if (kind === 'open-enjoying') return { type: 'open-enjoying' };
  if ((kind !== 'advance' && kind !== 'open') || typeof id !== 'string') return null;
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  if (kind === 'open') return { type: 'open', id };
  // The menu can be a few moments old: an item finished or reset since then must not be reopened.
  if (selectEnjoying([item]).length === 0) return null;
  const advance = advanceProgress(item);
  return advance ? { type: 'advance', id, updates: advance.updates } : null;
}
