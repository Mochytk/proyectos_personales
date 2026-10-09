import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { exportBackup, importBackup } from '@/store/backupFiles';

declare global {
  interface Window {
    /** Injected by electron-preload.js; delivers native menu clicks and shortcuts. */
    mediaTrackerMenu?: { onAction: (callback: (action: string) => void) => () => void };
  }
}

async function handleImport() {
  try {
    const result = await importBackup();
    if (result) window.alert(`Importado: ${result.added} nuevos, ${result.updated} actualizados. No se borró nada.`);
  } catch (e) {
    window.alert(e instanceof Error ? e.message : 'No se pudo importar el respaldo.');
  }
}

function run(action: string) {
  switch (action) {
    case 'new-item': return router.push('/modal');
    case 'new-list': return router.push('/newListModal');
    case 'search': return router.push('/searchModal');
    case 'settings': return router.push('/globalSettingsModal');
    case 'go-lists': return router.navigate('/');
    case 'go-enjoying': return router.navigate('/enjoying');
    case 'go-planner': return router.navigate('/planner');
    case 'go-logbook': return router.navigate('/logbook');
    case 'export-backup':
      try { window.alert(`Respaldo guardado: ${exportBackup()}`); } catch { window.alert('No se pudo exportar el respaldo.'); }
      return;
    case 'import-backup': return handleImport();
  }
}

/** Runs the native menu actions (Electron only). */
export function useMenuActions() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    return window.mediaTrackerMenu?.onAction(run);
  }, []);
}
