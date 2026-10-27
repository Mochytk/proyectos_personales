import {
  DEFAULT_DAY_CUTOFF_HOUR,
  DEFAULT_STYLE,
  DEFAULT_TIME_ZONE,
  type UserSettings,
} from '@habit-tracker/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDb } from '../db/DatabaseProvider';

export type Settings = Pick<UserSettings, 'timeZone' | 'dayCutoffHour' | 'style'>;

const DEFAULTS: Settings = {
  timeZone: DEFAULT_TIME_ZONE,
  dayCutoffHour: DEFAULT_DAY_CUTOFF_HOUR,
  style: DEFAULT_STYLE,
};

// The saved settings, live. The table holds a single row (ensureDefaults creates it);
// until it is read, the defaults apply.
export function useSettings(): Settings {
  const db = useDb();
  const saved = useLiveQuery(() => db.userSettings.toCollection().first(), [db]);
  return saved ?? DEFAULTS;
}
