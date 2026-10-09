import { describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ACTIONS, buildMenuTemplate } = require('../electron-menu.js');

type Item = { label?: string; accelerator?: string; click?: () => void; submenu?: Item[]; role?: string };
const build = (isMac: boolean, send = vi.fn()): Item[] => buildMenuTemplate({ isMac, appName: 'Media Tracker', send });
const flat = (menu: Item[]): Item[] => menu.flatMap((m) => [m, ...(m.submenu ? flat(m.submenu) : [])]);

describe('application menu', () => {
  it('has an app menu only on macOS', () => {
    expect(build(true)[0].label).toBe('Media Tracker');
    expect(build(false).map((m) => m.label)).not.toContain('Media Tracker');
  });

  it('keeps the standard edit menu so copy and paste work in text fields', () => {
    const roles = flat(build(true)).map((i) => i.role);
    for (const role of ['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']) expect(roles).toContain(role);
  });

  it('does not reuse a shortcut', () => {
    const accelerators = flat(build(true)).map((i) => i.accelerator).filter(Boolean);
    expect(new Set(accelerators).size).toBe(accelerators.length);
  });

  it('sends only known actions, and every action has a menu item', () => {
    const send = vi.fn();
    const clickable = flat(build(true, send)).filter((i) => i.click);
    clickable.forEach((i) => i.click!());
    const sent = send.mock.calls.map((c) => c[0]);
    expect(sent.every((a) => ACTIONS.includes(a))).toBe(true);
    expect(new Set(sent)).toEqual(new Set(ACTIONS));
  });
});
