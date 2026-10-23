import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SyncData } from '@/store/sync';
import { createSyncRunner } from '@/store/syncRunner';
import { useSyncStatus } from '@/store/syncStatus';
import { useStore } from '@/store/useStore';

declare global {
  interface Window {
    /** Injected by electron-preload.js; syncs through a shared folder. */
    mediaTrackerSync?: {
      getConfig(): Promise<{ deviceId: string; deviceName: string; folder: string | null }>;
      chooseFolder(): Promise<string | null>;
      disable(): Promise<void>;
      write(text: string): Promise<void>;
      readOthers(): Promise<string[]>;
      onChange(callback: () => void): () => void;
    };
  }
}

const RESYNC_EVERY_MS = 5 * 60 * 1000;
const AFTER_EDIT_MS = 3000;

const getData = (): SyncData => {
  const { items, lists, deleted } = useStore.getState();
  return { items, lists, deleted };
};

/** Keeps this device in step with the shared folder (desktop app only): at start, on changes, and periodically. */
export function useSync() {
  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.mediaTrackerSync : undefined;
    if (Platform.OS !== 'web' || !api) return;

    const status = useSyncStatus;
    const runner = createSyncRunner({ api, getData, apply: (data) => useStore.getState().applySync(data) });
    let running = false;
    let queued = false;
    let editTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const sync = async () => {
      if (stopped) return;
      if (running) { queued = true; return; }
      running = true;
      try {
        const config = await api.getConfig();
        if (!config.folder) {
          status.setState({ phase: 'off', folder: null, problems: [], error: undefined });
          return;
        }
        status.setState({ phase: 'syncing', folder: config.folder });
        const outcome = await runner.run();
        if (outcome.status === 'ok') {
          status.setState({ phase: 'idle', lastSyncAt: Date.now(), devices: outcome.devices, summary: outcome.summary, problems: outcome.problems, error: undefined });
        }
      } catch (error) {
        status.setState({ phase: 'error', error: error instanceof Error ? error.message : 'No se pudo sincronizar.' });
      } finally {
        running = false;
        if (queued) { queued = false; void sync(); }
      }
    };
    status.setState({ phase: 'off', syncNow: () => void sync() });

    // Wait for the saved data to load: syncing an empty, not-yet-loaded store would be pointless.
    const start = () => void sync();
    const unsubHydration = useStore.persist.hasHydrated() ? (start(), () => {}) : useStore.persist.onFinishHydration(start);

    const unsubChanges = api.onChange(() => void sync());
    const unsubStore = useStore.subscribe((state, previous) => {
      if (state.items === previous.items && state.lists === previous.lists && state.deleted === previous.deleted) return;
      clearTimeout(editTimer);
      editTimer = setTimeout(() => void sync(), AFTER_EDIT_MS);
    });
    const interval = setInterval(() => void sync(), RESYNC_EVERY_MS);
    const onFocus = () => void sync();
    window.addEventListener('focus', onFocus);

    return () => {
      stopped = true;
      clearTimeout(editTimer);
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      unsubHydration();
      unsubChanges();
      unsubStore();
    };
  }, []);
}
