import { create } from 'zustand';
import type { MergeSummary } from './sync';

interface SyncStatus {
  /** `unavailable`: not the desktop app. `off`: nothing chosen yet. */
  phase: 'unavailable' | 'off' | 'idle' | 'syncing' | 'error';
  folder: string | null;
  lastSyncAt?: number;
  devices?: number;
  summary?: MergeSummary;
  problems: string[];
  error?: string;
  /** Runs a sync pass now; the sync hook fills it in. */
  syncNow: () => void;
}

export const useSyncStatus = create<SyncStatus>(() => ({
  phase: 'unavailable',
  folder: null,
  problems: [],
  syncNow: () => {},
}));
