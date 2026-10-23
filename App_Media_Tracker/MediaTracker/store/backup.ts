import { backfillCompletedAt } from './completion';
import { sanitizeSaga } from './sagas';
import { sanitizeNextEpisode, sanitizeSeasons } from './seasons';
import type { AppSettings, MediaItem, MediaList, MediaType } from './useStore';

export const BACKUP_FORMAT = 'media-tracker-backup';

/**
 * Version of the backup FILE format. It is independent of STORE_VERSION (the local database).
 *
 * Every file this app exports must stay importable by every later version, so whenever what a
 * file contains changes (a new field, a renamed one, a new collection):
 *   1. bump this number,
 *   2. add `BACKUP_MIGRATIONS[<old version>]` to upgrade the old `data` to the new shape,
 *   3. add `tests/fixtures/backups/v<new version>.json`, a real export that is never edited again.
 * The tests fail if step 3 is forgotten, and they import every frozen fixture.
 */
export const BACKUP_SCHEMA_VERSION = 4;

type BackupData = Record<string, unknown>;

/** `BACKUP_MIGRATIONS[n]` upgrades the `data` of a version-n file to version n + 1. */
export const BACKUP_MIGRATIONS: Record<number, (data: BackupData) => BackupData> = {
  // v1 -> v2: books gained an optional `saga`. Old files simply have none, so nothing to convert;
  // the version bump makes older apps refuse v2 files instead of dropping the sagas.
  1: (data) => data,
  // v2 -> v3: items gained `completedAt` (when they were finished, used by the statistics).
  // Finished items from older files are dated by their last change.
  2: (data) => (Array.isArray(data.items) ? { ...data, items: backfillCompletedAt(data.items) } : data),
  // v3 -> v4: lists gained an optional `updatedAt` (needed to sync). Old lists have none and count as
  // the oldest copy, so nothing to convert.
  3: (data) => data,
};

/** Upgrades `data` from an older file version to `toVersion`, one step at a time. */
export function migrateBackupData(data: BackupData, fromVersion: number, toVersion: number = BACKUP_SCHEMA_VERSION): BackupData {
  let current = data;
  for (let version = fromVersion; version < toVersion; version++) {
    const migrate = BACKUP_MIGRATIONS[version];
    if (!migrate) throw new Error(`No hay forma de importar un respaldo de la versión ${fromVersion} (falta el paso de ${version} a ${version + 1}).`);
    current = migrate(current);
  }
  return current;
}

export interface StoreData {
  items: MediaItem[];
  lists: MediaList[];
  settings: AppSettings;
}

export const DEFAULT_SETTINGS: AppSettings = {
  showEnjoying: true,
  showPlanner: true,
  showLogbook: true,
  pileLayoutStyle: 'simple_list',
  pileItemShape: 'square',
};

const MEDIA_TYPES: MediaType[] = ['software', 'task', 'movie', 'tv_show', 'book', 'audiobook', 'video_game', 'board_game', 'music_album', 'app', 'event', 'note'];
const STATUSES: MediaItem['status'][] = ['unstarted', 'in_progress', 'completed', 'abandoned'];
const LIST_TYPES: MediaList['type'][] = ['todo', 'collection'];

const isObject = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const optNum = (v: unknown) => (isNum(v) ? v : undefined);
const optStr = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Returns a clean item, or null if the record is too broken to keep. */
export function sanitizeItem(raw: unknown): MediaItem | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.title !== 'string') return null;
  const now = Date.now();
  return {
    id: raw.id,
    title: raw.title,
    subtitle: optStr(raw.subtitle),
    type: MEDIA_TYPES.includes(raw.type) ? raw.type : 'software',
    status: STATUSES.includes(raw.status) ? raw.status : 'unstarted',
    progress: isNum(raw.progress) ? raw.progress : 0,
    totalCheckpoints: optNum(raw.totalCheckpoints),
    currentCheckpoint: optNum(raw.currentCheckpoint),
    checkpointType: raw.checkpointType,
    seasons: sanitizeSeasons(raw.seasons),
    nextEpisode: sanitizeNextEpisode(raw.nextEpisode),
    rating: optNum(raw.rating),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    notes: optStr(raw.notes),
    dueDate: optNum(raw.dueDate),
    dueHasTime: raw.dueHasTime === true ? true : undefined,
    remind: raw.remind === true ? true : undefined,
    notifiedAt: optNum(raw.notifiedAt),
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
    completedAt: optNum(raw.completedAt),
    listId: optStr(raw.listId),
    saga: sanitizeSaga(raw.saga),
    externalId: optStr(raw.externalId),
    posterUrl: optStr(raw.posterUrl),
    overview: optStr(raw.overview),
    releaseDate: optStr(raw.releaseDate),
  };
}

export function sanitizeList(raw: unknown): MediaList | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string') return null;
  return {
    id: raw.id,
    name: raw.name,
    isPinned: raw.isPinned === true,
    type: LIST_TYPES.includes(raw.type) ? raw.type : 'collection',
    layoutStyle: raw.layoutStyle,
    itemShape: raw.itemShape,
    sortOrder: raw.sortOrder,
    isSmartList: raw.isSmartList === true ? true : undefined,
    smartFilters: isObject(raw.smartFilters) ? raw.smartFilters : undefined,
    updatedAt: optNum(raw.updatedAt),
  };
}

export function sanitizeSettings(raw: unknown): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(isObject(raw) ? raw : {}) };
}

/** Clears listId on items whose list no longer exists. */
export function dropOrphanListRefs(items: MediaItem[], lists: MediaList[]): MediaItem[] {
  const listIds = new Set(lists.map(l => l.id));
  return items.map(i => (i.listId && !listIds.has(i.listId) ? { ...i, listId: undefined } : i));
}

/** Makes any persisted/imported shape safe to use: drops unusable records and fills defaults. */
export function normalizeData(raw: unknown): StoreData {
  const src = isObject(raw) ? raw : {};
  const lists = (Array.isArray(src.lists) ? src.lists : []).map(sanitizeList).filter((l): l is MediaList => l !== null);
  const items = (Array.isArray(src.items) ? src.items : []).map(sanitizeItem).filter((i): i is MediaItem => i !== null);
  return { items, lists, settings: sanitizeSettings(src.settings) };
}

/** Settings that must never leave this device. */
export const SECRET_SETTINGS = ['tmdbApiKey', 'rawgApiKey'] as const;

export function buildBackup(data: StoreData, schemaVersion: number = BACKUP_SCHEMA_VERSION): string {
  // Credentials stay on this device; a backup file may be shared or synced.
  const settings: Record<string, unknown> = { ...data.settings };
  for (const key of SECRET_SETTINGS) delete settings[key];
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      schemaVersion,
      exportedAt: new Date().toISOString(),
      data: { items: data.items, lists: data.lists, settings },
    },
    null,
    2,
  );
}

/**
 * Parses a backup file written by this or any earlier version of the app, upgrading old formats.
 * Throws an Error with a user-facing (Spanish) message.
 */
export function parseBackup(text: string, currentSchemaVersion: number = BACKUP_SCHEMA_VERSION): StoreData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT || !isObject(parsed.data)) {
    throw new Error('Este archivo no es un respaldo de Media Tracker.');
  }
  // Files without a version predate versioning and use the first format.
  const fileVersion = isNum(parsed.schemaVersion) && Number.isInteger(parsed.schemaVersion) && parsed.schemaVersion >= 1 ? parsed.schemaVersion : 1;
  if (fileVersion > currentSchemaVersion) {
    throw new Error('El respaldo es de una versión más nueva de la app. Actualiza Media Tracker e inténtalo de nuevo.');
  }
  return normalizeData(migrateBackupData(parsed.data, fileVersion, currentSchemaVersion));
}

/**
 * Non-destructive merge: records are matched by id and the most recently
 * updated one wins. Nothing already in the app is deleted.
 */
export function mergeData(current: StoreData, incoming: StoreData): StoreData & { added: number; updated: number } {
  let added = 0;
  let updated = 0;

  const items = new Map(current.items.map(i => [i.id, i]));
  for (const item of incoming.items) {
    const existing = items.get(item.id);
    if (!existing) {
      items.set(item.id, item);
      added++;
    } else if (item.updatedAt > existing.updatedAt) {
      items.set(item.id, item);
      updated++;
    }
  }

  const lists = new Map(current.lists.map(l => [l.id, l]));
  for (const list of incoming.lists) {
    if (!lists.has(list.id)) lists.set(list.id, list);
  }

  // Keep the user's current settings; a backup should not flip their tabs.
  const mergedLists = [...lists.values()];
  return { items: dropOrphanListRefs([...items.values()], mergedLists), lists: mergedLists, settings: current.settings, added, updated };
}
