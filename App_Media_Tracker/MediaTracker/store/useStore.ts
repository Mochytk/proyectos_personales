import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

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
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      items: [],
      lists: [],
      settings: {
        showEnjoying: true,
        showPlanner: true,
        showLogbook: true,
        pileLayoutStyle: 'simple_list',
        pileItemShape: 'square',
      },
      
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
    }),
    {
      name: 'media-tracker-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
