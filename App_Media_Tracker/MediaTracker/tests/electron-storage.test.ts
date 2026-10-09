import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createFileStorage } = require('../electron-storage.js');

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-storage-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

describe('file storage', () => {
  it('returns null for a missing key and stores values', async () => {
    const s = createFileStorage(dir);
    expect(await s.getItem('k')).toBeNull();
    await s.setItem('k', '{"a":1}');
    expect(await s.getItem('k')).toBe('{"a":1}');
  });

  it('keeps the last value when writes overlap', async () => {
    const s = createFileStorage(dir);
    await Promise.all([s.setItem('k', '{"a":1}'), s.setItem('k', '{"a":2}'), s.setItem('k', '{"a":3}')]);
    expect(await s.getItem('k')).toBe('{"a":3}');
  });

  it('falls back to the backup when the main file is corrupt, and does not overwrite it with garbage', async () => {
    const s = createFileStorage(dir);
    await s.setItem('k', '{"a":1}');
    await s.setItem('k', '{"a":2}');
    fs.writeFileSync(path.join(dir, 'k.json'), '{broken');
    expect(await s.getItem('k')).toBe('{"a":1}');
    await s.setItem('k', '{"a":3}');
    expect(fs.readFileSync(path.join(dir, 'k.json.bak'), 'utf8')).toBe('{"a":1}');
  });

  it('rejects unsafe keys and non-string values', async () => {
    const s = createFileStorage(dir);
    for (const key of ['../x', 'a/b', '', 'a.b', null]) await expect(s.getItem(key)).rejects.toThrow();
    await expect(s.setItem('k', 5)).rejects.toThrow();
  });

  it('removes a key', async () => {
    const s = createFileStorage(dir);
    await s.setItem('k', '{}');
    await s.removeItem('k');
    expect(await s.getItem('k')).toBeNull();
  });
});
