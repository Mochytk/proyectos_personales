import { describe, expect, it } from 'vitest';
import { TRAY_MAX_ENTRIES, TRAY_TEXT_MAX, advanceProgress, buildTraySnapshot, resolveTrayAction, selectEnjoying } from '../store/tray';
import type { MediaItem } from '../store/useStore';

let n = 0;
const item = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: `i${++n}`, title: `T${n}`, type: 'book', status: 'in_progress', progress: 0, createdAt: 1, updatedAt: 1, ...over,
});

describe('advanceProgress', () => {
  it('advances a series with seasons by one episode and names it', () => {
    const show = item({ type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 18, currentCheckpoint: 10, seasons: [10, 8] });
    expect(advanceProgress(show)).toEqual({ updates: { currentCheckpoint: 11, status: 'in_progress' }, label: 'Visto T2 · E1' });
  });

  it('does not advance a series that is at its last episode', () => {
    const show = item({ type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 18, currentCheckpoint: 18, seasons: [10, 8] });
    expect(advanceProgress(show)).toBeNull();
  });

  it('adds one chapter, episode or level', () => {
    expect(advanceProgress(item({ checkpointType: 'chapters', totalCheckpoints: 12, currentCheckpoint: 5 }))).toEqual({
      updates: { currentCheckpoint: 6, status: 'in_progress' }, label: '+1 capítulo',
    });
    expect(advanceProgress(item({ type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 12, currentCheckpoint: 0 }))?.label).toBe('+1 episodio');
    expect(advanceProgress(item({ type: 'video_game', checkpointType: 'levels', totalCheckpoints: 30, currentCheckpoint: 3 }))?.label).toBe('+1 nivel');
  });

  it('adds ten pages, never past the total, and stops at the end', () => {
    expect(advanceProgress(item({ checkpointType: 'pages', totalCheckpoints: 476, currentCheckpoint: 212 }))).toEqual({
      updates: { currentCheckpoint: 222, status: 'in_progress' }, label: '+10 páginas',
    });
    expect(advanceProgress(item({ checkpointType: 'pages', totalCheckpoints: 476, currentCheckpoint: 470 }))?.updates.currentCheckpoint).toBe(476);
    expect(advanceProgress(item({ checkpointType: 'pages', totalCheckpoints: 476, currentCheckpoint: 476 }))).toBeNull();
  });

  it('adds ten percent, up to 100', () => {
    expect(advanceProgress(item({ checkpointType: 'percentage', totalCheckpoints: 100, currentCheckpoint: 45 }))).toEqual({
      updates: { currentCheckpoint: 55, status: 'in_progress' }, label: '+10 %',
    });
    expect(advanceProgress(item({ checkpointType: 'percentage', totalCheckpoints: 100, currentCheckpoint: 95 }))?.updates.currentCheckpoint).toBe(100);
    expect(advanceProgress(item({ checkpointType: 'percentage', totalCheckpoints: 100, currentCheckpoint: 100 }))).toBeNull();
  });

  it('has no advance for items without a counter, and uses "paso" for custom measures', () => {
    expect(advanceProgress(item({ checkpointType: undefined, totalCheckpoints: undefined }))).toBeNull();
    expect(advanceProgress(item({ checkpointType: 'jefes' as MediaItem['checkpointType'], totalCheckpoints: 8, currentCheckpoint: 2 }))?.label).toBe('+1 paso');
  });
});

describe('selectEnjoying', () => {
  it('keeps unfinished items that are in progress or have some progress', () => {
    const items = [
      item({ id: 'a', status: 'in_progress' }),
      item({ id: 'b', status: 'unstarted', currentCheckpoint: 3 }),
      item({ id: 'c', status: 'unstarted', progress: 0.2 }),
      item({ id: 'd', status: 'unstarted' }),
      item({ id: 'e', status: 'completed', currentCheckpoint: 9 }),
    ];
    expect(selectEnjoying(items).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('buildTraySnapshot', () => {
  it('shows at most 8 entries, most recently changed first, and says there are more', () => {
    const items = Array.from({ length: 10 }, (_, i) => item({ id: `x${i}`, updatedAt: i }));
    const snapshot = buildTraySnapshot(items);
    expect(snapshot.entries).toHaveLength(TRAY_MAX_ENTRIES);
    expect(snapshot.entries.map((e) => e.id)).toEqual(['x9', 'x8', 'x7', 'x6', 'x5', 'x4', 'x3', 'x2', ]);
    expect(snapshot.hasMore).toBe(true);
    expect(buildTraySnapshot(items.slice(0, 8)).hasMore).toBe(false);
  });

  it('labels progress, and gives no advance to items without a counter', () => {
    const [seasons, pages, percent, plain] = buildTraySnapshot([
      item({ id: 's', updatedAt: 4, type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 30, currentCheckpoint: 13, seasons: [10, 8, 12] }),
      item({ id: 'p', updatedAt: 3, checkpointType: 'pages', totalCheckpoints: 476, currentCheckpoint: 212 }),
      item({ id: 'c', updatedAt: 2, checkpointType: 'percentage', totalCheckpoints: 100, currentCheckpoint: 45 }),
      item({ id: 'n', updatedAt: 1 }),
    ]).entries;
    expect(seasons).toMatchObject({ label: 'T2 · E3 · 13 de 30', advanceLabel: 'Visto T2 · E4' });
    expect(pages).toMatchObject({ label: 'Página 212 de 476', advanceLabel: '+10 páginas' });
    expect(percent).toMatchObject({ label: '45%', advanceLabel: '+10 %' });
    expect(plain).toMatchObject({ label: 'En curso' });
    expect(plain.advanceLabel).toBeUndefined();
  });

  it('cuts long titles to 80 characters without splitting an emoji, and names untitled items', () => {
    const [long, emoji, empty] = buildTraySnapshot([
      item({ updatedAt: 3, title: 'x'.repeat(200) }),
      item({ updatedAt: 2, title: '🎬'.repeat(100) }),
      item({ updatedAt: 1, title: '   ' }),
    ]).entries;
    expect(Array.from(long.title)).toHaveLength(TRAY_TEXT_MAX);
    expect(long.title.endsWith('…')).toBe(true);
    expect(Array.from(emoji.title)).toHaveLength(TRAY_TEXT_MAX);
    expect(emoji.title).toMatch(/^(🎬)+…$/u);
    expect(empty.title).toBe('Sin título');
  });
});

describe('resolveTrayAction', () => {
  const show = item({ id: 'show', type: 'tv_show', checkpointType: 'episodes', totalCheckpoints: 18, currentCheckpoint: 10, seasons: [10, 8] });
  const done = item({ id: 'done', checkpointType: 'pages', totalCheckpoints: 100, currentCheckpoint: 100 });
  const items = [show, done];

  it('resolves a valid advance into the changes to apply', () => {
    expect(resolveTrayAction({ kind: 'advance', id: 'show' }, items)).toEqual({ type: 'advance', id: 'show', updates: { currentCheckpoint: 11, status: 'in_progress' } });
  });

  it('ignores an advance for an item that was deleted since the menu was built', () => {
    expect(resolveTrayAction({ kind: 'advance', id: 'gone' }, items)).toBeNull();
    expect(resolveTrayAction({ kind: 'open', id: 'gone' }, items)).toBeNull();
  });

  it('ignores an advance for an item already at its end, so it neither overshoots nor finishes', () => {
    expect(resolveTrayAction({ kind: 'advance', id: 'done' }, items)).toBeNull();
  });

  it('ignores an advance for an item that left Disfrutando since the menu was built, so a finished item is not reopened', () => {
    const finished = item({ id: 'fin', status: 'completed', completedAt: 5, checkpointType: 'pages', totalCheckpoints: 100, currentCheckpoint: 40 });
    const reset = item({ id: 'reset', status: 'unstarted', progress: 0, checkpointType: 'pages', totalCheckpoints: 100, currentCheckpoint: 0 });
    expect(resolveTrayAction({ kind: 'advance', id: 'fin' }, [finished])).toBeNull();
    expect(resolveTrayAction({ kind: 'advance', id: 'reset' }, [reset])).toBeNull();
  });

  it('resolves opening an item and the Disfrutando tab', () => {
    expect(resolveTrayAction({ kind: 'open', id: 'show' }, items)).toEqual({ type: 'open', id: 'show' });
    expect(resolveTrayAction({ kind: 'open-enjoying' }, items)).toEqual({ type: 'open-enjoying' });
  });

  it('ignores anything that is not a known action', () => {
    for (const bad of [null, undefined, 'advance', 5, {}, { kind: 'delete', id: 'show' }, { kind: 'advance', id: 5 }, { kind: 'advance' }]) {
      expect(resolveTrayAction(bad, items)).toBeNull();
    }
  });
});
