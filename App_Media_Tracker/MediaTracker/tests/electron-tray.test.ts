import { describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildTrayTemplate, sanitizeSnapshot, shouldHideOnClose } = require('../electron-tray.js');

type Item = { label?: string; enabled?: boolean; type?: string; click?: () => void; submenu?: Item[] };
const entry = (id: string, over: Record<string, unknown> = {}) => ({ id, title: `Título ${id}`, label: 'T1 · E2', advanceLabel: 'Visto T1 · E3', ...over });
const handlers = () => ({ onAdvance: vi.fn(), onOpen: vi.fn(), onOpenEnjoying: vi.fn(), onShow: vi.fn(), onQuit: vi.fn() });
const labels = (template: Item[]) => template.map((i) => i.label ?? '---');

describe('sanitizeSnapshot', () => {
  it('turns anything that is not a snapshot into an empty one', () => {
    for (const bad of [undefined, null, 'x', 5, [], {}, { entries: 'no' }, { entries: { a: 1 } }]) {
      expect(sanitizeSnapshot(bad)).toEqual({ entries: [], hasMore: false });
    }
  });

  it('drops entries whose id, title or label is not a string', () => {
    const snapshot = sanitizeSnapshot({ entries: [entry('ok'), { id: 5, title: 't', label: 'l' }, { id: 'a', title: null, label: 'l' }, { id: 'b', title: 't' }, null, 'x'] });
    expect(snapshot.entries.map((e: { id: string }) => e.id)).toEqual(['ok']);
  });

  it('keeps at most 8 entries and only a true hasMore', () => {
    const many = Array.from({ length: 20 }, (_, i) => entry(`e${i}`));
    expect(sanitizeSnapshot({ entries: many }).entries).toHaveLength(8);
    expect(sanitizeSnapshot({ entries: [], hasMore: true }).hasMore).toBe(true);
    expect(sanitizeSnapshot({ entries: [], hasMore: 'yes' }).hasMore).toBe(false);
  });

  it('cuts every text to 80 characters and ids to 100, and ignores a bad advance label', () => {
    const [cut] = sanitizeSnapshot({ entries: [entry('x'.repeat(300), { title: 'a'.repeat(500), label: 'b'.repeat(500), advanceLabel: 'c'.repeat(500) })] }).entries;
    expect(cut.id).toHaveLength(100);
    expect(Array.from(cut.title)).toHaveLength(80);
    expect(Array.from(cut.label)).toHaveLength(80);
    expect(Array.from(cut.advanceLabel)).toHaveLength(80);
    const [plain] = sanitizeSnapshot({ entries: [entry('p', { advanceLabel: 42 })] }).entries;
    expect(plain.advanceLabel).toBeUndefined();
  });
});

describe('buildTrayTemplate', () => {
  it('lists the entries as submenus, with the advance action only when there is one', () => {
    const h = handlers();
    const template: Item[] = buildTrayTemplate({ entries: [entry('a'), entry('b', { advanceLabel: undefined, label: 'En curso' })], hasMore: false }, h);
    expect(template[0]).toMatchObject({ label: 'Disfrutando', enabled: false });
    expect(template[1].label).toBe('Título a — T1 · E2');
    expect(labels(template[1].submenu!)).toEqual(['Visto T1 · E3', 'Abrir detalle']);
    expect(template[2].label).toBe('Título b — En curso');
    expect(labels(template[2].submenu!)).toEqual(['Abrir detalle']);
  });

  it('sends the entry id back when an action is clicked', () => {
    const h = handlers();
    const template: Item[] = buildTrayTemplate({ entries: [entry('a')], hasMore: false }, h);
    template[1].submenu![0].click!();
    template[1].submenu![1].click!();
    expect(h.onAdvance).toHaveBeenCalledWith('a');
    expect(h.onOpen).toHaveBeenCalledWith('a');
  });

  it('ends with the fixed actions, which show the window and quit', () => {
    const h = handlers();
    const template: Item[] = buildTrayTemplate({ entries: [entry('a')], hasMore: false }, h);
    expect(labels(template).slice(-3)).toEqual(['---', 'Abrir Media Tracker', 'Salir de Media Tracker']);
    template.at(-2)!.click!();
    template.at(-1)!.click!();
    expect(h.onShow).toHaveBeenCalledTimes(1);
    expect(h.onQuit).toHaveBeenCalledTimes(1);
  });

  it('says there is nothing in progress, still offering the fixed actions', () => {
    const template: Item[] = buildTrayTemplate({ entries: [], hasMore: false }, handlers());
    expect(labels(template)).toEqual(['Disfrutando', 'Nada en curso', '---', 'Abrir Media Tracker', 'Salir de Media Tracker']);
    expect(template[1].enabled).toBe(false);
  });

  it('offers "Ver todo…" only when there are more entries than shown', () => {
    const h = handlers();
    const more: Item[] = buildTrayTemplate({ entries: [entry('a')], hasMore: true }, h);
    expect(labels(more)).toContain('Ver todo…');
    more.find((i) => i.label === 'Ver todo…')!.click!();
    expect(h.onOpenEnjoying).toHaveBeenCalledTimes(1);
    expect(labels(buildTrayTemplate({ entries: [entry('a')], hasMore: false }, h))).not.toContain('Ver todo…');
  });
});

describe('shouldHideOnClose', () => {
  it('hides the window on macOS, until the app is really quitting', () => {
    expect(shouldHideOnClose({ platform: 'darwin', quitting: false })).toBe(true);
    expect(shouldHideOnClose({ platform: 'darwin', quitting: true })).toBe(false);
  });

  it('keeps closing normally on other systems', () => {
    expect(shouldHideOnClose({ platform: 'linux', quitting: false })).toBe(false);
    expect(shouldHideOnClose({ platform: 'win32', quitting: false })).toBe(false);
  });
});
