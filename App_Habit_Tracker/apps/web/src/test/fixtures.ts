import { parseLocalDate, type Habit } from '@habit-tracker/shared';
import type { HabitDb } from '../db/db';
import { habitsRepo, type NewHabit } from '../db/habits-repo';

// Adds a habit under the named default anchor ("Al despertar" unless given).
export async function addHabit(
  db: HabitDb,
  overrides: Partial<NewHabit> & { anchor?: string } = {},
): Promise<Habit> {
  const { anchor: anchorName = 'Al despertar', ...fields } = overrides;
  const anchor = await db.anchors.filter((a) => a.name === anchorName).first();
  if (!anchor) throw new Error(`No anchor named ${anchorName}`);
  return habitsRepo(db).create({
    name: 'Leer',
    description: null,
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: parseLocalDate('2026-10-19'),
    anchorId: anchor.id,
    color: 'default',
    icon: null,
    ...fields,
  });
}
