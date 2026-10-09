import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

declare global {
  interface Window {
    /** Injected by electron-preload.js; stores data as files in the app's userData folder. */
    mediaTrackerStorage?: StateStorage;
  }
}

/**
 * In the Electron app data lives in a file on disk (see electron-storage.js), which survives
 * origin changes and cleared browser data. Everywhere else it falls back to AsyncStorage.
 */
export const appStorage: StateStorage =
  (typeof window !== 'undefined' && window.mediaTrackerStorage) || AsyncStorage;
