import type { MediaItem } from './useStore';

/**
 * Applies an update to an item and keeps `completedAt` (when it was finished) in step with `status`:
 * finishing an item stamps the moment, reopening it clears the stamp, and an explicit
 * `completedAt` in the update always wins (used to date something finished earlier).
 */
export function applyItemUpdate(item: MediaItem, updates: Partial<MediaItem>, now: number): MediaItem {
  let completedAt = item.completedAt;
  if ('completedAt' in updates) {
    completedAt = updates.completedAt;
  } else if (updates.status === 'completed' && item.status !== 'completed') {
    completedAt = now;
  } else if (updates.status !== undefined && updates.status !== 'completed' && item.status === 'completed') {
    completedAt = undefined;
  }
  return { ...item, ...updates, completedAt, updatedAt: now };
}

/** Items finished before `completedAt` existed get the best date we have: the last time they changed. */
export function backfillCompletedAt<T extends { status?: unknown; completedAt?: unknown; updatedAt?: unknown; createdAt?: unknown }>(items: T[]): T[] {
  return items.map((item) => {
    if (item.status !== 'completed' || typeof item.completedAt === 'number') return item;
    const fallback = typeof item.updatedAt === 'number' ? item.updatedAt : typeof item.createdAt === 'number' ? item.createdAt : undefined;
    return fallback === undefined ? item : { ...item, completedAt: fallback };
  });
}
