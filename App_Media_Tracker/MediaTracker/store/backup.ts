import type { AppSettings, MediaItem, MediaList, MediaType } from './useStore';

export const BACKUP_FORMAT = 'media-tracker-backup';

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
    rating: optNum(raw.rating),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t: unknown): t is string => typeof t === 'string') : [],
    notes: optStr(raw.notes),
    dueDate: optNum(raw.dueDate),
    createdAt: isNum(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isNum(raw.updatedAt) ? raw.updatedAt : now,
    listId: optStr(raw.listId),
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

export function buildBackup(data: StoreData, schemaVersion: number): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      schemaVersion,
      exportedAt: new Date().toISOString(),
      data: { items: data.items, lists: data.lists, settings: data.settings },
    },
    null,
    2,
  );
}

/** Parses a backup file. Throws an Error with a user-facing (Spanish) message. */
export function parseBackup(text: string, currentSchemaVersion: number): StoreData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!isObject(parsed) || parsed.format !== BACKUP_FORMAT || !isObject(parsed.data)) {
    throw new Error('Este archivo no es un respaldo de Media Tracker.');
  }
  if (isNum(parsed.schemaVersion) && parsed.schemaVersion > currentSchemaVersion) {
    throw new Error('El respaldo es de una versión más nueva de la app. Actualiza Media Tracker e inténtalo de nuevo.');
  }
  return normalizeData(parsed.data);
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
