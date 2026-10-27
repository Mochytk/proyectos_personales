import { anchorSchema, type Anchor } from '@habit-tracker/shared';
import type { HabitDb } from './db';
import { nowIso, writeRows } from './write';

export class AnchorInUseError extends Error {
  constructor() {
    super('The anchor still groups active habits');
    this.name = 'AnchorInUseError';
  }
}

function isListed(anchor: Anchor): boolean {
  return anchor.deletedAt === null && anchor.archivedAt === null;
}

export function anchorsRepo(db: HabitDb) {
  async function save(id: string, change: (anchor: Anchor, now: string) => Anchor) {
    await db.transaction('rw', db.anchors, db.outbox, async () => {
      const anchor = await db.anchors.get(id);
      if (!anchor) throw new Error(`Anchor not found: ${id}`);
      const now = nowIso();
      await writeRows(db, 'anchors', [anchorSchema.parse(change(anchor, now))], now);
    });
  }

  return {
    async create(name: string): Promise<void> {
      await db.transaction('rw', db.anchors, db.outbox, async () => {
        const anchors = await db.anchors.toArray();
        const sortOrder = anchors.reduce((max, anchor) => Math.max(max, anchor.sortOrder + 1), 0);
        const now = nowIso();
        const anchor = anchorSchema.parse({
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          name,
          sortOrder,
          archivedAt: null,
        });
        await writeRows(db, 'anchors', [anchor], now);
      });
    },
    rename(id: string, name: string): Promise<void> {
      return save(id, (anchor) => ({ ...anchor, name }));
    },
    // Swaps places with the neighbour in the visible list. Sort orders are renumbered
    // as it goes, so ties left by a sync never block a move; only changed rows are written.
    async move(id: string, direction: 'up' | 'down'): Promise<void> {
      await db.transaction('rw', db.anchors, db.outbox, async () => {
        const all = await db.anchors.orderBy('sortOrder').toArray();
        const listed = all.filter(isListed);
        const from = listed.findIndex((anchor) => anchor.id === id);
        const to = direction === 'up' ? from - 1 : from + 1;
        const moving = listed[from];
        const other = listed[to];
        if (!moving || !other) return;
        listed[from] = other;
        listed[to] = moving;
        const hidden = all.filter((anchor) => !isListed(anchor));
        const changed = [...listed, ...hidden].flatMap((anchor, sortOrder) =>
          anchor.sortOrder === sortOrder ? [] : [{ ...anchor, sortOrder }],
        );
        if (changed.length > 0) await writeRows(db, 'anchors', changed);
      });
    },
    async archive(id: string): Promise<void> {
      await db.transaction('rw', db.anchors, db.habits, db.outbox, async () => {
        const inUse = await db.habits
          .where('anchorId')
          .equals(id)
          .filter((habit) => habit.deletedAt === null && habit.archivedAt === null)
          .count();
        if (inUse > 0) throw new AnchorInUseError();
        await save(id, (anchor, now) => ({ ...anchor, archivedAt: now }));
      });
    },
    unarchive(id: string): Promise<void> {
      return save(id, (anchor) => ({ ...anchor, archivedAt: null }));
    },
  };
}
