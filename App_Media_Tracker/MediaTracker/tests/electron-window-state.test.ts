import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_SIZE, loadWindowState, restoreBounds, saveWindowState } = require('../electron-window-state.js');

const screen1 = { x: 0, y: 0, width: 1440, height: 900 };
const screen2 = { x: 1440, y: 0, width: 1920, height: 1080 };

describe('restoreBounds', () => {
  it('uses the default size without saved state or with a broken one', () => {
    expect(restoreBounds(null, [screen1])).toEqual(DEFAULT_SIZE);
    expect(restoreBounds({ width: 'x' }, [screen1])).toEqual(DEFAULT_SIZE);
  });

  it('restores size and position on a connected screen', () => {
    expect(restoreBounds({ x: 100, y: 80, width: 900, height: 700 }, [screen1])).toEqual({ x: 100, y: 80, width: 900, height: 700 });
    expect(restoreBounds({ x: 1600, y: 50, width: 900, height: 700 }, [screen1, screen2])).toMatchObject({ x: 1600, y: 50 });
  });

  it('drops the position when its screen is gone but keeps the size', () => {
    const result = restoreBounds({ x: 1600, y: 50, width: 900, height: 700 }, [screen1]);
    expect(result).toEqual({ width: 900, height: 700 });
  });

  it('does not allow a tiny window', () => {
    expect(restoreBounds({ width: 10, height: 10 }, [screen1])).toMatchObject({ width: 480, height: 480 });
  });
});

describe('load / save', () => {
  it('round-trips and tolerates a missing or corrupt file', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-win-'));
    const file = path.join(dir, 'window-state.json');
    expect(loadWindowState(file)).toBeNull();
    saveWindowState(file, { x: 1, y: 2, width: 800, height: 600, isMaximized: true });
    expect(loadWindowState(file)).toEqual({ x: 1, y: 2, width: 800, height: 600, isMaximized: true });
    fs.writeFileSync(file, '{broken');
    expect(loadWindowState(file)).toBeNull();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
