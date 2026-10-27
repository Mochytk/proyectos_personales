import {
  anchorSchema,
  DEFAULT_DAY_CUTOFF_HOUR,
  DEFAULT_STYLE,
  DEFAULT_TIME_ZONE,
  seedId,
  userSettingsSchema,
} from '@habit-tracker/shared';
import type { HabitDb } from './db';
import { writeRows } from './write';

// The slugs are part of the sync contract: they give every device the same ids.
export const DEFAULT_ANCHORS = [
  { slug: 'wake-up', name: 'Al despertar' },
  { slug: 'morning', name: 'Mañana' },
  { slug: 'after-lunch', name: 'Después de almorzar' },
  { slug: 'afternoon', name: 'Tarde' },
  { slug: 'evening', name: 'Noche' },
  { slug: 'before-bed', name: 'Antes de dormir' },
  { slug: 'after-workout', name: 'Después de entrenar' },
] as const;

// Seed rows carry the oldest possible date, so an edit made on any device beats the
// untouched copy another device creates later (last write wins, ADR 0006).
export const SEED_TIMESTAMP = '2000-01-01T00:00:00.000Z';

export function settingsId(): Promise<string> {
  return seedId('user_settings', 'default');
}

// Creates whatever is missing. A default anchor the user renamed or deleted stays as is.
export async function ensureDefaults(db: HabitDb): Promise<void> {
  const settings = await settingsId();
  const anchorIds = await Promise.all(DEFAULT_ANCHORS.map(({ slug }) => seedId('anchor', slug)));
  const seed = { createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP, deletedAt: null };

  await db.transaction('rw', db.userSettings, db.anchors, db.outbox, async () => {
    if (!(await db.userSettings.get(settings))) {
      const row = userSettingsSchema.parse({
        ...seed,
        id: settings,
        timeZone: DEFAULT_TIME_ZONE,
        dayCutoffHour: DEFAULT_DAY_CUTOFF_HOUR,
        style: DEFAULT_STYLE,
      });
      await writeRows(db, 'userSettings', [row], SEED_TIMESTAMP);
    }

    const existing = await db.anchors.bulkGet(anchorIds);
    const missing = DEFAULT_ANCHORS.flatMap(({ name }, sortOrder) => {
      const id = anchorIds[sortOrder];
      if (id === undefined || existing[sortOrder]) return [];
      return [anchorSchema.parse({ ...seed, id, name, sortOrder, archivedAt: null })];
    });
    if (missing.length > 0) await writeRows(db, 'anchors', missing, SEED_TIMESTAMP);
  });
}
