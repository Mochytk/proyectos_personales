import { Platform } from 'react-native';
import { buildBackup, parseBackup } from './backup';
import { STORE_VERSION, useStore } from './useStore';

/** Backups use browser file APIs, so they are available in the web / Electron build only. */
export const backupSupported = Platform.OS === 'web';

export function exportBackup(): string {
  const { items, lists, settings } = useStore.getState();
  const text = buildBackup({ items, lists, settings }, STORE_VERSION);
  const date = new Date().toISOString().slice(0, 10);
  const filename = `media-tracker-respaldo-${date}.json`;

  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
}

/** Opens a file picker and merges the chosen backup. Resolves null if the user cancels. */
export function importBackup(): Promise<{ added: number; updated: number } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        const incoming = parseBackup(await file.text(), STORE_VERSION);
        resolve(useStore.getState().importData(incoming));
      } catch (e) {
        reject(e);
      }
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
