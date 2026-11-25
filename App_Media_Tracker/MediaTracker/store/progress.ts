import { describeProgress, hasSeasonSplit } from './seasons';
import type { MediaItem } from './useStore';

/** How much the pages counter and the percentage move per tap (detail screen and menu bar). */
export const PAGE_STEP = 10;
export const PERCENT_STEP = 10;

/** Above this many checkpoints a checkbox per step stops being usable (a 476-page book). */
export const MAX_CHECKLIST_STEPS = 40;

/** Pages, and anything with too many steps, are tracked with a counter instead of a checklist. */
export function usesCounter(checkpointType: string | undefined, total: number): boolean {
  return checkpointType === 'pages' || total > MAX_CHECKLIST_STEPS;
}

/** Moves a counter by `delta`, kept between 0 and `total`. Non-numeric input counts as 0. */
export function clampProgress(current: number, delta: number, total: number): number {
  const base = Number.isFinite(current) ? current : 0;
  return Math.min(total, Math.max(0, Math.round(base + delta)));
}

const UNIT_LABELS_ES: Record<string, string> = { episodes: 'Episodio', chapters: 'Capítulo', pages: 'Página', levels: 'Nivel' };

/**
 * Where an item stands, as Disfrutando shows it (without the subtitle): "45% Completado",
 * "T2 · E3 · 13 de 30", "Página 212 de 476". Undefined when the item has no counter.
 */
export function progressText(item: MediaItem): string | undefined {
  const current = item.currentCheckpoint || 0;
  if (item.checkpointType === 'percentage') return `${current}% Completado`;
  if (hasSeasonSplit(item)) return describeProgress(current, item.seasons);
  if (item.totalCheckpoints && item.totalCheckpoints > 0) {
    const unit = item.checkpointType
      ? (UNIT_LABELS_ES[item.checkpointType] ?? item.checkpointType.charAt(0).toUpperCase() + item.checkpointType.slice(1))
      : (item.type === 'tv_show' ? 'Episodio' : 'Capítulo');
    return `${unit} ${current} de ${item.totalCheckpoints}`;
  }
  return undefined;
}
