import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { appStorage } from './storage';
import { applyItemUpdate, backfillCompletedAt } from './completion';
import type { Saga } from './sagas';
import { Tombstones, addTombstone, emptyTombstones, sanitizeTombstones } from './tombstones';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SETTINGS, StoreData, dropOrphanListRefs, mergeData, normalizeData } from './backup';

// Bump this whenever the persisted shape changes, and handle the old version in `migrate` below.
export const STORE_VERSION = 3;

export type MediaType = 'software' | 'task' | 'movie' | 'tv_show' | 'book' | 'audiobook' | 'video_game' | 'board_game' | 'music_album' | 'app' | 'event' | 'note';

export interface SmartFilters {
  types?: MediaType[];
  minRating?: number;
}

export interface MediaItem {
  id: string;
  title: string;
  subtitle?: string;
  type: MediaType;
  status: 'unstarted' | 'in_progress' | 'completed' | 'abandoned';
  
  progress: number;
  totalCheckpoints?: number;
  currentCheckpoint?: number;
  checkpointType?: 'episodes' | 'pages' | 'chapters' | 'levels' | 'percentage';
  /** Episodes per season (series). When set, `totalCheckpoints` is their sum. */
  seasons?: number[];
  /** Next episode to air, as announced by TMDB the last time the item was refreshed. */
  nextEpisode?: { date: string; season: number; episode: number };
  
  rating?: number; // 1-5 stars
  tags?: string[];
  notes?: string;
  
  dueDate?: number; // timestamp for reminders / planner (local midnight when there is no time)
  dueHasTime?: boolean; // false/undefined: date only
  remind?: boolean; // show a notification when the item is due
  notifiedAt?: number; // set once the reminder has fired

  createdAt: number;
  updatedAt: number;
  /** When the item was finished; set automatically when its status becomes `completed`. */
  completedAt?: number;
  
  listId?: string;
  /** Saga the book belongs to (books only). */
  saga?: Saga;

  // Filled when the item was picked from a metadata search (TMDB, Open Library, RAWG).
  externalId?: string;
  posterUrl?: string;
  overview?: string;
  releaseDate?: string;
}

export interface MediaList {
  id: string;
  name: string;
  isPinned: boolean;
  type: 'todo' | 'collection';
  layoutStyle?: 'simple_list' | 'large_grid' | 'medium_grid' | 'small_grid';
  itemShape?: 'short' | 'square' | 'medium' | 'tall' | 'wide';
  sortOrder?: 'new_old' | 'old_new' | 'a_z' | 'z_a';
  
  isSmartList?: boolean;
  smartFilters?: SmartFilters;
}

export interface AppSettings {
  showEnjoying: boolean;
  showPlanner: boolean;
  showLogbook: boolean;
  pileLayoutStyle?: 'simple_list' | 'large_grid';
  pileItemShape?: 'short' | 'square' | 'tall';
  /** API credentials. Local to this device: never included in backups (see SECRET_SETTINGS). */
  tmdbApiKey?: string;
  rawgApiKey?: string;
}

interface AppState {
  items: MediaItem[];
  lists: MediaList[];
  settings: AppSettings;
  /** What was deleted and when, so syncing does not bring it back. */
  deleted: Tombstones;
  
  addItem: (item: Omit<MediaItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateItem: (id: string, updates: Partial<MediaItem>) => void;
  removeItem: (id: string) => void;
  
  addList: (list: Omit<MediaList, 'id'>) => void;
  updateList: (id: string, updates: Partial<MediaList>) => void;
  removeList: (id: string) => void;

  updateSettings: (updates: Partial<AppSettings>) => void;

  /** Merges backup data into the current data (newest `updatedAt` wins, nothing is deleted). */
  importData: (incoming: StoreData) => { added: number; updated: number };
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      items: [],
      lists: [],
      settings: DEFAULT_SETTINGS,
      deleted: emptyTombstones(),
      
      addItem: (itemData) => set((state) => ({
        items: [
          ...state.items, 
          { 
            ...itemData, 
            id: uuidv4(), 
            createdAt: Date.now(), 
            updatedAt: Date.now(),
            completedAt: itemData.status === 'completed' ? (itemData.completedAt ?? Date.now()) : undefined,
            tags: itemData.tags ?? [],
          }
        ]
      })),
      
      updateItem: (id, updates) => set((state) => ({
        items: state.items.map(item => 
          item.id === id ? applyItemUpdate(item, updates, Date.now()) : item
        )
      })),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id),
        deleted: addTombstone(state.deleted, 'items', id, Date.now()),
      })),
      
      addList: (listData) => set((state) => ({
        lists: [
          ...state.lists,
          { ...listData, id: uuidv4() }
        ]
      })),
      
      updateList: (id, updates) => set((state) => ({
        lists: state.lists.map(list => 
          list.id === id ? { ...list, ...updates } : list
        )
      })),
      
      removeList: (id) => set((state) => {
        const now = Date.now();
        // The items that were in the list change too, so their updatedAt moves and a sync carries it.
        const updatedItems = state.items.map(item => 
          item.listId === id ? { ...item, listId: undefined, updatedAt: now } : item
        );
        return {
          lists: state.lists.filter(list => list.id !== id),
          items: updatedItems,
          deleted: addTombstone(state.deleted, 'lists', id, now),
        };
      }),

      updateSettings: (updates) => set((state) => ({
        settings: { ...state.settings, ...updates }
      })),

      importData: (incoming) => {
        const { items, lists, settings } = get();
        const { added, updated, ...merged } = mergeData({ items, lists, settings }, incoming);
        set(merged);
        return { added, updated };
      },
    }),
    {
      name: 'media-tracker-storage',
      storage: createJSONStorage(() => appStorage),
      version: STORE_VERSION,
      // Data saved before versioning existed arrives as version 0. Add a `if (version < N)` step
      // here for each future shape change instead of discarding what the user already saved.
      migrate: (persisted, version) => {
        const data = normalizeData(persisted);
        // v1 -> v2: items gained `completedAt`; finished ones are dated by their last change.
        const items = version < 2 ? backfillCompletedAt(data.items) : data.items;
        // v2 -> v3: `deleted` (tombstones) is new; older data starts with none.
        const deleted = sanitizeTombstones((persisted as { deleted?: unknown } | undefined)?.deleted);
        return { ...data, items: dropOrphanListRefs(items, data.lists), deleted } as unknown as AppState;
      },
      // Default merge is shallow: without this, settings added in a later release would be
      // missing for users whose stored `settings` object predates them.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}) } };
      },
    }
  )
);
