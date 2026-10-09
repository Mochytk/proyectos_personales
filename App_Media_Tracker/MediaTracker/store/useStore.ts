import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { appStorage } from './storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_SETTINGS, StoreData, dropOrphanListRefs, mergeData, normalizeData } from './backup';

// Bump this whenever the persisted shape changes, and handle the old version in `migrate` below.
export const STORE_VERSION = 1;

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
  
  rating?: number; // 1-5 stars
  tags?: string[];
  notes?: string;
  
  dueDate?: number; // timestamp for reminders / planner

  createdAt: number;
  updatedAt: number;
  
  listId?: string;

  // Filled when the item was picked from a metadata search (TMDB).
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
  /** TMDB credential. Local to this device: never included in backups. */
  tmdbApiKey?: string;
}

interface AppState {
  items: MediaItem[];
  lists: MediaList[];
  settings: AppSettings;
  
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
      
      addItem: (itemData) => set((state) => ({
        items: [
          ...state.items, 
          { 
            ...itemData, 
            id: uuidv4(), 
            createdAt: Date.now(), 
            updatedAt: Date.now(),
            tags: [],
          }
        ]
      })),
      
      updateItem: (id, updates) => set((state) => ({
        items: state.items.map(item => 
          item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
        )
      })),
      
      removeItem: (id) => set((state) => ({
        items: state.items.filter(item => item.id !== id)
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
        const updatedItems = state.items.map(item => 
          item.listId === id ? { ...item, listId: undefined } : item
        );
        return {
          lists: state.lists.filter(list => list.id !== id),
          items: updatedItems
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
      migrate: (persisted) => {
        const data = normalizeData(persisted);
        return { ...data, items: dropOrphanListRefs(data.items, data.lists) } as unknown as AppState;
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
