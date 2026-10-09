const fs = require('fs');
const path = require('path');

// Keys come from the renderer, so only plain identifiers are allowed (no path separators).
const KEY_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_VALUE_BYTES = 50 * 1024 * 1024;

/**
 * Key/value storage backed by one JSON file per key inside `dir`.
 * Writes go to a temp file first and are renamed into place, and the previous
 * good copy is kept as `<key>.json.bak`, so a crash mid-write cannot corrupt the data.
 */
function createFileStorage(dir) {
  const queues = new Map();

  const fileFor = (key) => {
    if (typeof key !== 'string' || !KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
    return path.join(dir, `${key}.json`);
  };

  const isValidJson = (text) => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  async function readIfValid(file) {
    try {
      const text = await fs.promises.readFile(file, 'utf8');
      return isValidJson(text) ? text : null;
    } catch {
      return null;
    }
  }

  async function getItem(key) {
    const file = fileFor(key);
    return (await readIfValid(file)) ?? (await readIfValid(`${file}.bak`));
  }

  // Writes for the same key run one after another so the last call always wins.
  function enqueue(key, task) {
    const next = (queues.get(key) ?? Promise.resolve()).catch(() => {}).then(task);
    queues.set(key, next);
    return next;
  }

  function setItem(key, value) {
    const file = fileFor(key);
    if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_VALUE_BYTES) {
      return Promise.reject(new Error('Invalid storage value'));
    }
    return enqueue(key, async () => {
      await fs.promises.mkdir(dir, { recursive: true });
      const tmp = `${file}.tmp`;
      await fs.promises.writeFile(tmp, value, 'utf8');
      // Only promote the current file to .bak if it is itself intact.
      if (await readIfValid(file)) await fs.promises.copyFile(file, `${file}.bak`);
      await fs.promises.rename(tmp, file);
    });
  }

  function removeItem(key) {
    const file = fileFor(key);
    return enqueue(key, async () => {
      await Promise.all([file, `${file}.bak`, `${file}.tmp`].map((f) => fs.promises.rm(f, { force: true })));
    });
  }

  return { getItem, setItem, removeItem };
}

module.exports = { createFileStorage };
