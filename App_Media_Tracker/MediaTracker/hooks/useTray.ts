import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { TraySnapshot, buildTraySnapshot, resolveTrayAction } from '@/store/tray';
import { useStore } from '@/store/useStore';

declare global {
  interface Window {
    /** Injected by electron-preload.js (macOS): the menu bar icon. */
    mediaTrackerTray?: {
      update(snapshot: TraySnapshot): void;
      onAction(callback: (action: unknown) => void): () => void;
    };
  }
}

const UPDATE_DELAY_MS = 300;

/** Keeps the menu bar icon's menu up to date and runs what is chosen in it (desktop app on macOS). */
export function useTray() {
  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.mediaTrackerTray : undefined;
    if (Platform.OS !== 'web' || !api) return;

    const send = () => api.update(buildTraySnapshot(useStore.getState().items));

    // Listen before the first update: sending it tells the main process this page can take actions.
    const stopActions = api.onAction((action) => {
      const resolved = resolveTrayAction(action, useStore.getState().items);
      if (!resolved) return;
      if (resolved.type === 'advance') useStore.getState().updateItem(resolved.id, resolved.updates);
      else if (resolved.type === 'open') router.push(`/item/${resolved.id}`);
      else router.navigate('/enjoying');
    });

    // Wait for the saved data to load, so the menu is not built from an empty store.
    const stopHydration = useStore.persist.hasHydrated() ? (send(), () => {}) : useStore.persist.onFinishHydration(send);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopStore = useStore.subscribe((state, previous) => {
      if (state.items === previous.items) return;
      clearTimeout(timer);
      timer = setTimeout(send, UPDATE_DELAY_MS);
    });

    return () => {
      clearTimeout(timer);
      stopActions();
      stopHydration();
      stopStore();
    };
  }, []);
}
