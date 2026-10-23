import { dropOrphanListRefs, sanitizeItem, sanitizeList } from './backup';
import { Tombstones, sanitizeTombstones } from './tombstones';
import type { MediaItem, MediaList } from './useStore';

/**
 * Sync works on files in a shared folder (iCloud Drive, Dropbox...). Each device writes only its
 * own file and reads everyone else's, so a cloud service never has two writers on one file and
 * never creates "conflicted copies". Everything is merged here, per record: the newest change wins.
 */
export const SYNC_FORMAT = 'media-tracker-sync';

/** Version of the sync file. Same rule as the backup: bump, migrate, never break older files. */
export const SYNC_SCHEMA_VERSION = 1;

export interface SyncData {
  items: MediaItem[];
  lists: MediaList[];
  deleted: Tombstones;
}

export interface SyncFile {
  deviceId: string;
  /** When the device wrote the file (epoch ms). */
  savedAt: number;
  data: SyncData;
}

export function buildSyncFile(data: SyncData, deviceId: string, now: number = Date.now()): string {
  return JSON.stringify({ format: SYNC_FORMAT, schemaVersion: SYNC_SCHEMA_VERSION, deviceId, savedAt: now, data });
}

/** Reads a sync file written by this or an older version. Throws an Error with a user-facing message. */
export function parseSyncFile(text: string): SyncFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo de sincronización no es un JSON válido.');
  }
  const file = parsed as { format?: unknown; schemaVersion?: unknown; deviceId?: unknown; savedAt?: unknown; data?: Record<string, unknown> };
  if (typeof parsed !== 'object' || parsed === null || file.format !== SYNC_FORMAT || typeof file.data !== 'object' || file.data === null) {
    throw new Error('Este archivo no es de la sincronización de Media Tracker.');
  }
  if (typeof file.schemaVersion === 'number' && file.schemaVersion > SYNC_SCHEMA_VERSION) {
    throw new Error('Otro dispositivo usa una versión más nueva de Media Tracker. Actualiza la app para seguir sincronizando.');
  }
  if (typeof file.deviceId !== 'string' || !file.deviceId) throw new Error('El archivo de sincronización no indica de qué dispositivo es.');
  const data = file.data;
  return {
    deviceId: file.deviceId,
    savedAt: typeof file.savedAt === 'number' && Number.isFinite(file.savedAt) ? file.savedAt : 0,
    data: {
      items: (Array.isArray(data.items) ? data.items : []).map(sanitizeItem).filter((i): i is MediaItem => i !== null),
      lists: (Array.isArray(data.lists) ? data.lists : []).map(sanitizeList).filter((l): l is MediaList => l !== null),
      deleted: sanitizeTombstones(data.deleted),
    },
  };
}

/** Of two copies of a record, the one changed last; on a tie, a fixed rule so every device agrees. */
function newest<T extends { updatedAt?: number }>(a: T, b: T): T {
  const diff = (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
  if (diff !== 0) return diff > 0 ? a : b;
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b;
}

function pickNewest<T extends { id: string; updatedAt?: number }>(groups: T[][]): Map<string, T> {
  const picked = new Map<string, T>();
  for (const record of groups.flat()) {
    const current = picked.get(record.id);
    picked.set(record.id, current ? newest(current, record) : record);
  }
  return picked;
}

function unionDeleted(all: Tombstones[]): Tombstones {
  const merge = (kind: keyof Tombstones) => {
    const out: Record<string, number> = {};
    for (const t of all) for (const [id, at] of Object.entries(t[kind])) out[id] = Math.max(out[id] ?? -Infinity, at);
    return out;
  };
  return { items: merge('items'), lists: merge('lists') };
}

/**
 * Merges this device's data with the data of other devices. The result is the same whatever the
 * order or how many times it is applied, so devices converge:
 * - each record is the copy changed last;
 * - something deleted stays deleted unless it was changed after the deletion;
 * - items of a deleted list are unlisted.
 */
export function mergeSyncData(local: SyncData, remotes: SyncData[]): SyncData {
  const all = [local, ...remotes];
  const deleted = unionDeleted(all.map((d) => d.deleted));
  const survives = (record: { id: string; updatedAt?: number }, tombstones: Record<string, number>) =>
    !(record.id in tombstones) || (record.updatedAt ?? 0) > tombstones[record.id];

  const lists = [...pickNewest(all.map((d) => d.lists)).values()].filter((l) => survives(l, deleted.lists));
  const items = [...pickNewest(all.map((d) => d.items)).values()].filter((i) => survives(i, deleted.items));
  return { items: dropOrphanListRefs(items, lists), lists, deleted };
}

export interface MergeSummary {
  added: number;
  updated: number;
  removed: number;
}

/** What a merge changed in this device, for the status message. */
export function summarizeMerge(before: SyncData, after: SyncData): MergeSummary {
  const old = new Map(before.items.map((i) => [i.id, i]));
  const now = new Set(after.items.map((i) => i.id));
  return {
    added: after.items.filter((i) => !old.has(i.id)).length,
    updated: after.items.filter((i) => old.has(i.id) && old.get(i.id)!.updatedAt !== i.updatedAt).length,
    removed: before.items.filter((i) => !now.has(i.id)).length,
  };
}
