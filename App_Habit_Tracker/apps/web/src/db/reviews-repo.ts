import {
  quotaOverrideId,
  weeklyQuotaOverrideSchema,
  weeklyReviewId,
  weeklyReviewSchema,
  type LocalDate,
  type WeeklyReview,
} from '@habit-tracker/shared';
import type { HabitDb } from './db';
import { nowIso, writeRows } from './write';

// The Sunday review (RF-1.6). Reviews and quota overrides have deterministic ids, so two
// devices reviewing the same week write the same rows (ADR 0006).
export function reviewsRepo(db: HabitDb) {
  async function saveReview(
    weekStart: LocalDate,
    change: (review: WeeklyReview, now: string) => WeeklyReview,
  ): Promise<void> {
    const id = await weeklyReviewId(weekStart);
    await db.transaction('rw', db.weeklyReviews, db.outbox, async () => {
      const now = nowIso();
      const current = (await db.weeklyReviews.get(id)) ?? {
        id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        weekStart,
        reflection: null,
        completedAt: null,
      };
      const row = weeklyReviewSchema.parse(change({ ...current, deletedAt: null }, now));
      await writeRows(db, 'weeklyReviews', [row], now);
    });
  }

  return {
    saveReflection(weekStart: LocalDate, reflection: string): Promise<void> {
      const text = reflection.trim();
      return saveReview(weekStart, (review) => ({
        ...review,
        reflection: text === '' ? null : text,
      }));
    },
    complete(weekStart: LocalDate): Promise<void> {
      return saveReview(weekStart, (review, now) => ({ ...review, completedAt: now }));
    },
    // The quota of one habit for one week; 0 pauses the week.
    async setQuota(habitId: string, weekStart: LocalDate, quota: number): Promise<void> {
      const id = await quotaOverrideId(habitId, weekStart);
      await db.transaction('rw', db.weeklyQuotaOverrides, db.outbox, async () => {
        const now = nowIso();
        const current = await db.weeklyQuotaOverrides.get(id);
        const row = weeklyQuotaOverrideSchema.parse({
          id,
          createdAt: current?.createdAt ?? now,
          updatedAt: now,
          deletedAt: null,
          habitId,
          weekStart,
          quota,
        });
        await writeRows(db, 'weeklyQuotaOverrides', [row], now);
      });
    },
  };
}
