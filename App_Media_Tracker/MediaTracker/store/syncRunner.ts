import { pruneTombstones } from './tombstones';
import { MergeSummary, SyncData, buildSyncFile, canonicalSyncJson, mergeSyncData, parseSyncFile, summarizeMerge } from './sync';

/** Deletions are remembered this long; a device that stays off longer than this could bring things back. */
export const TOMBSTONE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

/** What the runner needs from the outside, so it can be tested without Electron or the real store. */
export interface SyncDeps {
  api: {
    getConfig(): Promise<{ deviceId: string; folder: string | null }>;
    write(text: string): Promise<void>;
    readOthers(): Promise<string[]>;
  };
  getData(): SyncData;
  /** Replaces this device's data with the merged result. */
  apply(data: SyncData): void;
  now?: () => number;
}

export type SyncOutcome =
  | { status: 'off' }
  | { status: 'ok'; summary: MergeSummary; devices: number; problems: string[]; wrote: boolean };

/**
 * One sync pass: read the other devices' files, merge them into this device, and write this
 * device's file. Remembers what it last wrote so an unchanged state is not rewritten (a cloud
 * folder would otherwise upload the same file again and again).
 */
export function createSyncRunner(deps: SyncDeps) {
  const now = deps.now ?? Date.now;
  let lastWritten: string | undefined;

  async function run(): Promise<SyncOutcome> {
    const config = await deps.api.getConfig();
    if (!config.folder) return { status: 'off' };

    // Everything that needs waiting comes first: from reading the data to applying the merge there
    // is no `await`, so an edit made while files were being read cannot be overwritten.
    const texts = await deps.api.readOthers();
    const remotes: SyncData[] = [];
    const problems: string[] = [];
    for (const text of texts) {
      try {
        remotes.push(parseSyncFile(text).data);
      } catch (error) {
        problems.push(error instanceof Error ? error.message : 'Archivo de sincronización ilegible.');
      }
    }

    const current = deps.getData();
    const local: SyncData = { ...current, deleted: pruneTombstones(current.deleted, now(), TOMBSTONE_MAX_AGE_MS) };
    const merged = mergeSyncData(local, remotes);
    const summary = summarizeMerge(current, merged);
    if (canonicalSyncJson(merged) !== canonicalSyncJson(current)) deps.apply(merged);

    const canonical = canonicalSyncJson(merged);
    let wrote = false;
    if (canonical !== lastWritten) {
      await deps.api.write(buildSyncFile(merged, config.deviceId, now()));
      lastWritten = canonical;
      wrote = true;
    }
    return { status: 'ok', summary, devices: remotes.length + 1, problems, wrote };
  }

  return { run };
}
