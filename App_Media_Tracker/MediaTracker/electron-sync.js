const fs = require('fs');
const path = require('path');

// One file per device in the shared folder: a device only ever writes its own file.
const FILE_PREFIX = 'media-tracker-sync-';
const FILE_SUFFIX = '.json';
const DEVICE_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 20;

const isSyncFileName = (name) => name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX);

/** Reads and writes sync files in `dir` for the device `deviceId`. */
function createSyncFolder(dir, deviceId) {
  if (typeof deviceId !== 'string' || !DEVICE_ID_PATTERN.test(deviceId)) throw new Error('Invalid device id');
  const ownName = `${FILE_PREFIX}${deviceId}${FILE_SUFFIX}`;
  const ownPath = path.join(dir, ownName);

  async function assertFolder() {
    let stat;
    try {
      stat = await fs.promises.stat(dir);
    } catch {
      throw new Error('La carpeta de sincronización ya no existe o no está disponible.');
    }
    if (!stat.isDirectory()) throw new Error('La carpeta de sincronización ya no existe o no está disponible.');
  }

  /** Writes this device's file; it goes to a temporary name first so nobody reads a half-written file. */
  async function writeOwn(text) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_FILE_BYTES) throw new Error('Invalid sync content');
    await assertFolder();
    const tmp = `${ownPath}.tmp`;
    await fs.promises.writeFile(tmp, text, 'utf8');
    await fs.promises.rename(tmp, ownPath);
  }

  /** The other devices' files. Unreadable or oversized ones are skipped, never fatal. */
  async function readOthers() {
    await assertFolder();
    const names = (await fs.promises.readdir(dir)).filter((n) => isSyncFileName(n) && n !== ownName).sort().slice(0, MAX_FILES);
    const files = [];
    for (const name of names) {
      try {
        const file = path.join(dir, name);
        const stat = await fs.promises.stat(file);
        if (!stat.isFile() || stat.size > MAX_FILE_BYTES) continue;
        files.push({ name, text: await fs.promises.readFile(file, 'utf8') });
      } catch {
        // A file another device is replacing, or one the cloud has not downloaded yet.
      }
    }
    return files;
  }

  /** Calls `onChange` (debounced) when another device's file appears or changes. Returns a stop function. */
  function watch(onChange, debounceMs = 400) {
    let timer = null;
    let watcher;
    try {
      watcher = fs.watch(dir, { persistent: false }, (_event, name) => {
        if (!name || !isSyncFileName(name) || name === ownName) return;
        clearTimeout(timer);
        timer = setTimeout(onChange, debounceMs);
      });
      watcher.on('error', () => {});
    } catch {
      return () => {};
    }
    return () => {
      clearTimeout(timer);
      watcher.close();
    };
  }

  return { ownName, writeOwn, readOthers, watch };
}

/** Reads this device's sync settings ({ deviceId, folder? }); a missing or broken file gives {}. */
function loadSyncConfig(file) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return {
      deviceId: typeof raw.deviceId === 'string' && DEVICE_ID_PATTERN.test(raw.deviceId) ? raw.deviceId : undefined,
      folder: typeof raw.folder === 'string' && raw.folder ? raw.folder : undefined,
    };
  } catch {
    return {};
  }
}

function saveSyncConfig(file, config) {
  fs.writeFileSync(file, JSON.stringify({ deviceId: config.deviceId, folder: config.folder }), 'utf8');
}

module.exports = { createSyncFolder, isSyncFileName, loadSyncConfig, saveSyncConfig, FILE_PREFIX, DEVICE_ID_PATTERN };
