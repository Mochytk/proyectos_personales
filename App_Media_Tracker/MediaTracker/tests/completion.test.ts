import { describe, expect, it } from 'vitest';
import { applyItemUpdate, backfillCompletedAt } from '../store/completion';
import { BACKUP_FORMAT, parseBackup } from '../store/backup';
import type { MediaItem } from '../store/useStore';

const item = (over: Partial<MediaItem> = {}): MediaItem => ({ id: '1', title: 'x', type: 'movie', status: 'in_progress', progress: 0, createdAt: 1, updatedAt: 5, ...over });

describe('applyItemUpdate', () => {
  it('stamps the moment an item is finished', () => {
    expect(applyItemUpdate(item(), { status: 'completed' }, 100)).toMatchObject({ status: 'completed', completedAt: 100, updatedAt: 100 });
  });

  it('keeps the original date when an already finished item is edited', () => {
    const done = item({ status: 'completed', completedAt: 50 });
    expect(applyItemUpdate(done, { notes: 'n' }, 100).completedAt).toBe(50);
    expect(applyItemUpdate(done, { status: 'completed' }, 100).completedAt).toBe(50);
  });

  it('clears the date when the item is reopened, and stamps again when finished again', () => {
    const done = item({ status: 'completed', completedAt: 50 });
    const reopened = applyItemUpdate(done, { status: 'in_progress' }, 100);
    expect(reopened.completedAt).toBeUndefined();
    expect(applyItemUpdate(reopened, { status: 'completed' }, 200).completedAt).toBe(200);
  });

  it('lets an explicit date win, to record something finished earlier', () => {
    expect(applyItemUpdate(item(), { status: 'completed', completedAt: 10 }, 100).completedAt).toBe(10);
    expect(applyItemUpdate(item({ status: 'completed', completedAt: 50 }), { completedAt: 20 }, 100).completedAt).toBe(20);
  });

  it('leaves unfinished items without a date', () => {
    expect(applyItemUpdate(item(), { progress: 0.5 }, 100).completedAt).toBeUndefined();
  });
});

describe('backfillCompletedAt', () => {
  it('dates finished items by their last change and leaves the rest alone', () => {
    const result = backfillCompletedAt([
      { status: 'completed', updatedAt: 70, createdAt: 1 },
      { status: 'completed', completedAt: 40, updatedAt: 70 },
      { status: 'in_progress', updatedAt: 70 },
      { status: 'completed', createdAt: 9 },
      { status: 'completed' },
    ]);
    expect(result.map((r) => r.completedAt)).toEqual([70, 40, undefined, 9, undefined]);
  });
});

describe('v2 backups', () => {
  it('get their finished items dated when imported', () => {
    const file = JSON.stringify({
      format: BACKUP_FORMAT, schemaVersion: 2,
      data: { items: [{ id: 'a', title: 'A', status: 'completed', updatedAt: 1760000000000 }, { id: 'b', title: 'B', status: 'unstarted', updatedAt: 1 }] },
    });
    const [a, b] = parseBackup(file).items;
    expect(a.completedAt).toBe(1760000000000);
    expect(b.completedAt).toBeUndefined();
  });
});
