import { describe, expect, it } from 'vitest';
import { SyncData, buildSyncFile, canonicalSyncJson } from '../store/sync';
import { TOMBSTONE_MAX_AGE_MS, createSyncRunner } from '../store/syncRunner';
import { emptyTombstones } from '../store/tombstones';
import type { MediaItem } from '../store/useStore';

const item = (id: string, updatedAt: number, over: Partial<MediaItem> = {}): MediaItem => ({
  id, title: id, type: 'movie', status: 'unstarted', progress: 0, tags: [], createdAt: 1, updatedAt, ...over,
});

/** A device: its own data and a runner talking to a fake shared folder. */
function device(deviceId: string, folder: Map<string, string> | null, data: SyncData, clock = { now: 1_000_000 }) {
  const state = { data, writes: 0, applied: 0 };
  const runner = createSyncRunner({
    api: {
      getConfig: async () => ({ deviceId, folder: folder ? '/shared' : null }),
      write: async (text) => { state.writes++; folder!.set(deviceId, text); },
      readOthers: async () => [...folder!.entries()].filter(([id]) => id !== deviceId).map(([, text]) => text),
    },
    getData: () => state.data,
    apply: (merged) => { state.data = merged; state.applied++; },
    now: () => clock.now,
  });
  return { state, run: runner.run };
}
const empty = (): SyncData => ({ items: [], lists: [], deleted: emptyTombstones() });

describe('createSyncRunner', () => {
  it('does nothing when sync is not set up', async () => {
    const d = device('device-aaaa-1111', null, empty());
    expect(await d.run()).toEqual({ status: 'off' });
    expect(d.state.writes).toBe(0);
  });

  it('writes this device on the first pass even with no other devices', async () => {
    const folder = new Map<string, string>();
    const d = device('device-aaaa-1111', folder, { ...empty(), items: [item('a', 5)] });
    const outcome = await d.run();
    expect(outcome).toMatchObject({ status: 'ok', devices: 1, wrote: true });
    expect(folder.has('device-aaaa-1111')).toBe(true);
    expect(d.state.applied).toBe(0);
  });

  it('does not rewrite the file when nothing changed', async () => {
    const folder = new Map<string, string>();
    const d = device('device-aaaa-1111', folder, { ...empty(), items: [item('a', 5)] });
    await d.run();
    expect((await d.run())).toMatchObject({ wrote: false });
    expect(d.state.writes).toBe(1);
  });

  it('two devices converge on adds, edits and deletions', async () => {
    const folder = new Map<string, string>();
    const mac1 = device('device-aaaa-1111', folder, { ...empty(), items: [item('shared', 1, { title: 'old' }), item('only1', 1)] });
    const mac2 = device('device-bbbb-2222', folder, { ...empty(), items: [item('only2', 1)] });

    await mac1.run(); await mac2.run(); await mac1.run();
    expect(mac1.state.data.items.map((i) => i.id).sort()).toEqual(['only1', 'only2', 'shared']);
    expect(canonicalSyncJson(mac1.state.data)).toBe(canonicalSyncJson(mac2.state.data));

    // mac1 edits one item and deletes another; mac2 sees both.
    mac1.state.data = {
      items: mac1.state.data.items.filter((i) => i.id !== 'only2').map((i) => (i.id === 'shared' ? { ...i, title: 'new', updatedAt: 50 } : i)),
      lists: [],
      deleted: { items: { only2: 60 }, lists: {} },
    };
    await mac1.run(); await mac2.run();
    expect(mac2.state.data.items.map((i) => i.id).sort()).toEqual(['only1', 'shared']);
    expect(mac2.state.data.items.find((i) => i.id === 'shared')!.title).toBe('new');
    expect(canonicalSyncJson(mac1.state.data)).toBe(canonicalSyncJson(mac2.state.data));
  });

  it('reports problem files and keeps going with the good ones', async () => {
    const folder = new Map<string, string>([
      ['device-bbbb-2222', buildSyncFile({ ...empty(), items: [item('b', 1)] }, 'device-bbbb-2222')],
      ['device-cccc-3333', 'not json'],
      ['device-dddd-4444', JSON.stringify({ format: 'media-tracker-sync', schemaVersion: 99, deviceId: 'device-dddd-4444', data: {} })],
    ]);
    const d = device('device-aaaa-1111', folder, empty());
    const outcome = await d.run();
    expect(outcome).toMatchObject({ status: 'ok', devices: 2 });
    expect(outcome.status === 'ok' && outcome.problems).toHaveLength(2);
    expect(d.state.data.items.map((i) => i.id)).toEqual(['b']);
  });

  it('forgets deletions older than the limit, not recent ones', async () => {
    const folder = new Map<string, string>();
    const clock = { now: 10 * TOMBSTONE_MAX_AGE_MS };
    const d = device('device-aaaa-1111', folder, { ...empty(), deleted: { items: { old: 1, fresh: clock.now - 1000 }, lists: {} } }, clock);
    await d.run();
    expect(d.state.data.deleted.items).toEqual({ fresh: clock.now - 1000 });
  });

  it('an edit made while the files were being read is not lost', async () => {
    const folder = new Map<string, string>([['device-bbbb-2222', buildSyncFile({ ...empty(), items: [item('b', 1)] }, 'device-bbbb-2222')]]);
    const data = { current: { ...empty(), items: [item('a', 1)] } };
    const runner = createSyncRunner({
      api: {
        getConfig: async () => ({ deviceId: 'device-aaaa-1111', folder: '/shared' }),
        write: async () => {},
        // The user edits while "reading" is in progress.
        readOthers: async () => { data.current = { ...data.current, items: [item('a', 9, { title: 'edited while reading' })] }; return [...folder.values()]; },
      },
      getData: () => data.current,
      apply: (merged) => { data.current = merged; },
    });
    await runner.run();
    expect(data.current.items.find((i) => i.id === 'a')!.title).toBe('edited while reading');
  });
});
