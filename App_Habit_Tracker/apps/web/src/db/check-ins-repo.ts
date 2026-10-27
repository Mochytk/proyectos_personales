import {
  checkInId,
  checkInSchema,
  type CheckIn,
  type LocalDate,
  type SkipReason,
} from '@habit-tracker/shared';
import type { HabitDb } from './db';
import { nowIso, writeRows } from './write';

type Mark = Pick<CheckIn, 'status' | 'skipReason' | 'note'>;

function isActive(checkIn: CheckIn | undefined): checkIn is CheckIn {
  return checkIn?.deletedAt === null;
}

// One check-in per habit and day, with a deterministic id (ADR 0006). Ids are computed
// before each transaction: Web Crypto is not a Dexie API and would end it early.
export function checkInsRepo(db: HabitDb) {
  function build(
    id: string,
    habitId: string,
    date: LocalDate,
    mark: Mark,
    existing: CheckIn | undefined,
    now: string,
  ): CheckIn {
    return checkInSchema.parse({
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      habitId,
      localDate: date,
      value: existing?.value ?? null,
      ...mark,
    });
  }

  async function set(habitId: string, date: LocalDate, mark: Mark): Promise<void> {
    const id = await checkInId(habitId, date);
    await db.transaction('rw', db.checkIns, db.outbox, async () => {
      const existing = await db.checkIns.get(id);
      const unchanged =
        isActive(existing) &&
        existing.status === mark.status &&
        existing.skipReason === mark.skipReason &&
        existing.note === mark.note;
      if (unchanged) return;
      const now = nowIso();
      await writeRows(db, 'checkIns', [build(id, habitId, date, mark, existing, now)], now);
    });
  }

  return {
    markDone(habitId: string, date: LocalDate): Promise<void> {
      return set(habitId, date, { status: 'done', skipReason: null, note: null });
    },
    skip(habitId: string, date: LocalDate, reason: SkipReason, note?: string): Promise<void> {
      return set(habitId, date, { status: 'skipped', skipReason: reason, note: note ?? null });
    },
    // Unmarking is a soft delete, so the other devices learn about it (ADR 0006).
    async clear(habitId: string, date: LocalDate): Promise<void> {
      const id = await checkInId(habitId, date);
      await db.transaction('rw', db.checkIns, db.outbox, async () => {
        const existing = await db.checkIns.get(id);
        if (!isActive(existing)) return;
        const now = nowIso();
        await writeRows(db, 'checkIns', [{ ...existing, deletedAt: now }], now);
      });
    },
    // "Pausar el día": skips every given habit that has no record yet, never touching
    // one already marked.
    async pauseDay(date: LocalDate, reason: SkipReason, habitIds: string[]): Promise<void> {
      const ids = await Promise.all(habitIds.map((habitId) => checkInId(habitId, date)));
      await db.transaction('rw', db.checkIns, db.outbox, async () => {
        const existing = await db.checkIns.bulkGet(ids);
        const now = nowIso();
        const mark: Mark = { status: 'skipped', skipReason: reason, note: null };
        const rows = habitIds.flatMap((habitId, i) => {
          const id = ids[i];
          const current = existing[i];
          if (id === undefined || isActive(current)) return [];
          return [build(id, habitId, date, mark, current, now)];
        });
        if (rows.length > 0) await writeRows(db, 'checkIns', rows, now);
      });
    },
  };
}
