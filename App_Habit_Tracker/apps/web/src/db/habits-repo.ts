import { habitSchema, type Habit } from '@habit-tracker/shared';
import type { HabitDb } from './db';
import { nowIso, writeRows } from './write';

export type NewHabit = Pick<
  Habit,
  | 'name'
  | 'description'
  | 'mode'
  | 'weeklyQuota'
  | 'weekdays'
  | 'startsOn'
  | 'anchorId'
  | 'color'
  | 'icon'
>;

// Every row is validated with the shared schema before it is stored, so the local
// database never holds what the server would reject.
export function habitsRepo(db: HabitDb) {
  async function save(id: string, change: (habit: Habit, now: string) => Habit): Promise<Habit> {
    return db.transaction('rw', db.habits, db.outbox, async () => {
      const habit = await db.habits.get(id);
      if (!habit) throw new Error(`Habit not found: ${id}`);
      const now = nowIso();
      const [saved] = await writeRows(db, 'habits', [habitSchema.parse(change(habit, now))], now);
      return saved ?? habit;
    });
  }

  return {
    async create(input: NewHabit): Promise<Habit> {
      return db.transaction('rw', db.habits, db.outbox, async () => {
        const habits = await db.habits.toArray();
        const sortOrder = habits.reduce((max, habit) => Math.max(max, habit.sortOrder + 1), 0);
        const now = nowIso();
        const habit = habitSchema.parse({
          ...input,
          id: crypto.randomUUID(),
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          sortOrder,
          archivedAt: null,
        });
        const [saved] = await writeRows(db, 'habits', [habit], now);
        return saved ?? habit;
      });
    },
    update(id: string, patch: Partial<NewHabit>): Promise<Habit> {
      return save(id, (habit) => ({ ...habit, ...patch }));
    },
    archive(id: string): Promise<Habit> {
      return save(id, (habit, now) => ({ ...habit, archivedAt: now }));
    },
    unarchive(id: string): Promise<Habit> {
      return save(id, (habit) => ({ ...habit, archivedAt: null }));
    },
  };
}
