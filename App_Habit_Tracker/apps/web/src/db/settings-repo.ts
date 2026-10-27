import { userSettingsSchema, type UserSettings } from '@habit-tracker/shared';
import type { HabitDb } from './db';
import { settingsId } from './defaults';
import { writeRows } from './write';

export type SettingsPatch = Partial<Pick<UserSettings, 'timeZone' | 'dayCutoffHour' | 'style'>>;

export async function updateSettings(db: HabitDb, patch: SettingsPatch): Promise<void> {
  const id = await settingsId();
  await db.transaction('rw', db.userSettings, db.outbox, async () => {
    const settings = await db.userSettings.get(id);
    if (!settings) throw new Error('Settings not found');
    await writeRows(db, 'userSettings', [userSettingsSchema.parse({ ...settings, ...patch })]);
  });
}
