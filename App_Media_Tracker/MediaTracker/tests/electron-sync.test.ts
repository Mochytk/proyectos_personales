import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createSyncFolder, isSyncFileName, loadSyncConfig, saveSyncConfig } = require('../electron-sync.js');

let dir: string;
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-sync-')); });
afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

const waitFor = async (condition: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!condition() && Date.now() - start < ms) await new Promise((r) => setTimeout(r, 25));
  return condition();
};

describe('createSyncFolder', () => {
  it('rejects device ids that are not safe file names', () => {
    for (const id of ['', 'x', '../../etc/passwd-aaaa', 'a/b/c/d/e/f/g/h', 'ok ok ok ok']) expect(() => createSyncFolder(dir, id)).toThrow();
  });

  it('writes only its own file, with no temporary file left', async () => {
    const sync = createSyncFolder(dir, 'device-aaaa-1111');
    await sync.writeOwn('{"a":1}');
    await sync.writeOwn('{"a":2}');
    expect(fs.readdirSync(dir)).toEqual([sync.ownName]);
    expect(fs.readFileSync(path.join(dir, sync.ownName), 'utf8')).toBe('{"a":2}');
  });

  it("reads the other devices' files and not its own or unrelated ones", async () => {
    const mine = createSyncFolder(dir, 'device-aaaa-1111');
    const other = createSyncFolder(dir, 'device-bbbb-2222');
    await mine.writeOwn('mine');
    await other.writeOwn('theirs');
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'unrelated');
    fs.writeFileSync(path.join(dir, 'media-tracker-sync-x.json.tmp'), 'half written');
    expect(await mine.readOthers()).toEqual([{ name: other.ownName, text: 'theirs' }]);
    expect(await other.readOthers()).toEqual([{ name: mine.ownName, text: 'mine' }]);
  });

  it('says so when the folder is gone, instead of creating it', async () => {
    const gone = path.join(dir, 'missing');
    const sync = createSyncFolder(gone, 'device-aaaa-1111');
    await expect(sync.writeOwn('x')).rejects.toThrow(/carpeta de sincronización/);
    await expect(sync.readOthers()).rejects.toThrow(/carpeta de sincronización/);
    expect(fs.existsSync(gone)).toBe(false);
  });

  it('rejects content that is not a string', async () => {
    await expect(createSyncFolder(dir, 'device-aaaa-1111').writeOwn(5 as unknown as string)).rejects.toThrow();
  });

  it("notifies when another device's file changes, but not for its own", async () => {
    const mine = createSyncFolder(dir, 'device-aaaa-1111');
    const other = createSyncFolder(dir, 'device-bbbb-2222');
    let calls = 0;
    const stop = mine.watch(() => { calls++; }, 50);
    await mine.writeOwn('mine');
    await new Promise((r) => setTimeout(r, 300));
    expect(calls).toBe(0);
    await other.writeOwn('theirs');
    expect(await waitFor(() => calls > 0)).toBe(true);
    stop();
  });
});

describe('isSyncFileName', () => {
  it('recognises sync files only', () => {
    expect(isSyncFileName('media-tracker-sync-abc.json')).toBe(true);
    expect(isSyncFileName('media-tracker-sync-abc.json.tmp')).toBe(false);
    expect(isSyncFileName('other.json')).toBe(false);
  });
});

describe('sync config', () => {
  it('round-trips and tolerates a missing, broken or tampered file', () => {
    const file = path.join(dir, 'sync-config.json');
    expect(loadSyncConfig(file)).toEqual({});
    saveSyncConfig(file, { deviceId: 'device-aaaa-1111', folder: '/Users/x/iCloud' });
    expect(loadSyncConfig(file)).toEqual({ deviceId: 'device-aaaa-1111', folder: '/Users/x/iCloud' });
    saveSyncConfig(file, { deviceId: 'device-aaaa-1111' });
    expect(loadSyncConfig(file)).toEqual({ deviceId: 'device-aaaa-1111', folder: undefined });
    fs.writeFileSync(file, '{broken');
    expect(loadSyncConfig(file)).toEqual({});
    fs.writeFileSync(file, JSON.stringify({ deviceId: '../../evil', folder: 5 }));
    expect(loadSyncConfig(file)).toEqual({ deviceId: undefined, folder: undefined });
  });
});
