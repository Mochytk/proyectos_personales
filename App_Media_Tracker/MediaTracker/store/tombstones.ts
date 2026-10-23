/**
 * Record of what the user deleted, by id and time. Without it, syncing would bring a deleted item
 * back from another device that still has it.
 */
export interface Tombstones {
  items: Record<string, number>;
  lists: Record<string, number>;
}

export const emptyTombstones = (): Tombstones => ({ items: {}, lists: {} });

/** Adds a deletion. If the id was already recorded, the earlier time is kept. */
export function addTombstone(tombstones: Tombstones, kind: keyof Tombstones, id: string, now: number): Tombstones {
  if (id in tombstones[kind]) return tombstones;
  return { ...tombstones, [kind]: { ...tombstones[kind], [id]: now } };
}

/** Reads tombstones from storage or a sync file, dropping anything that is not `id -> time`. */
export function sanitizeTombstones(raw: unknown): Tombstones {
  const clean = (value: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      for (const [id, time] of Object.entries(value)) {
        if (id && typeof time === 'number' && Number.isFinite(time)) out[id] = time;
      }
    }
    return out;
  };
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  return { items: clean(src.items), lists: clean(src.lists) };
}

/** Forgets deletions older than `maxAgeMs`: by then every device has long since seen them. */
export function pruneTombstones(tombstones: Tombstones, now: number, maxAgeMs: number): Tombstones {
  const keep = (record: Record<string, number>) =>
    Object.fromEntries(Object.entries(record).filter(([, deletedAt]) => now - deletedAt <= maxAgeMs));
  return { items: keep(tombstones.items), lists: keep(tombstones.lists) };
}
