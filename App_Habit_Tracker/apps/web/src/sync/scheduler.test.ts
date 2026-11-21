import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncResult } from './engine';
import { backoffDelay, SyncScheduler, type SchedulerDeps } from './scheduler';

function deps(overrides: Partial<SchedulerDeps> = {}) {
  const results: SyncResult[] = [];
  const base: SchedulerDeps = {
    attempt: vi.fn(() => Promise.resolve<SyncResult>({ status: 'synced' })),
    version: vi.fn(() => Promise.resolve<number | null>(0)),
    cursor: vi.fn(() => Promise.resolve(0)),
    visible: () => true,
    random: () => 0.5,
    onResult: (result) => results.push(result),
    ...overrides,
  };
  return { deps: base, results };
}

// Lets the scheduler's awaited promises settle between timer steps.
async function flush() {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
}

describe('backoffDelay', () => {
  it('doubles from 1 s up to 5 minutes, within 20 % either way', () => {
    expect(backoffDelay(1, () => 0.5)).toBe(1000);
    expect(backoffDelay(2, () => 0.5)).toBe(2000);
    expect(backoffDelay(3, () => 0.5)).toBe(4000);
    expect(backoffDelay(20, () => 0.5)).toBe(300_000);
    expect(backoffDelay(1, () => 0)).toBe(800);
    expect(backoffDelay(1, () => 1)).toBe(1200);
  });
});

describe('SyncScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs 2 s after the last local write', async () => {
    const { deps: d } = deps();
    const scheduler = new SyncScheduler(d);
    scheduler.localWrite();
    await vi.advanceTimersByTimeAsync(1000);
    scheduler.localWrite();
    await vi.advanceTimersByTimeAsync(1999);
    expect(d.attempt).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(d.attempt).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('retries after 1, 2 and 4 s, then stops once synced', async () => {
    const outcomes: SyncResult[] = [
      { status: 'offline' },
      { status: 'offline' },
      { status: 'error', message: 'boom' },
      { status: 'synced' },
    ];
    const attempt = vi.fn(() =>
      Promise.resolve<SyncResult>(outcomes.shift() ?? { status: 'synced' }),
    );
    const { deps: d, results } = deps({ attempt });
    const scheduler = new SyncScheduler(d);

    scheduler.request();
    await flush();
    expect(attempt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(999);
    expect(attempt).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(attempt).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(attempt).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(attempt).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(attempt).toHaveBeenCalledTimes(4);
    expect(results.at(-1)).toEqual({ status: 'synced' });
    scheduler.stop();
  });

  it('does not retry a closed session until asked again', async () => {
    const attempt = vi.fn(() => Promise.resolve<SyncResult>({ status: 'unauthenticated' }));
    const { deps: d } = deps({ attempt });
    const scheduler = new SyncScheduler(d);
    scheduler.request();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(attempt).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('asks for the version every 15 s while visible, and pulls when it moved ahead', async () => {
    let remote = 0;
    const version = vi.fn(() => Promise.resolve<number | null>(remote));
    const { deps: d } = deps({ version, cursor: () => Promise.resolve(3) });
    const scheduler = new SyncScheduler(d);
    scheduler.start();
    await flush();
    expect(d.attempt).toHaveBeenCalledTimes(1);

    remote = 3;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(version).toHaveBeenCalledTimes(1);
    expect(d.attempt).toHaveBeenCalledTimes(1);

    remote = 4;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(d.attempt).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('does not ask for the version while the app is hidden', async () => {
    const { deps: d } = deps({ visible: () => false });
    const scheduler = new SyncScheduler(d);
    scheduler.start();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(d.version).not.toHaveBeenCalled();
    scheduler.stop();
  });

  it('runs one sync at a time, and once more if asked meanwhile', async () => {
    let release: () => void = () => undefined;
    const attempt = vi.fn(
      () =>
        new Promise<SyncResult>((resolve) => {
          release = () => {
            resolve({ status: 'synced' });
          };
        }),
    );
    const { deps: d } = deps({ attempt });
    const scheduler = new SyncScheduler(d);
    scheduler.request();
    scheduler.request();
    scheduler.request();
    await flush();
    expect(attempt).toHaveBeenCalledTimes(1);
    release();
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);
    release();
    await flush();
    expect(attempt).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });
});
