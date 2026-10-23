import { diffDays, weekStart } from '../dates/calendar';
import { parseLocalDate, type LocalDate } from '../dates/local-date';
import type { StyleSetting } from '../schemas/habits';

export type VisualStyle = Exclude<StyleSetting, 'rotate'>;

// "rotate" changes style every Monday in this order (ADR 0009).
const ROTATION: readonly VisualStyle[] = ['cuaderno', 'linea', 'disco'];
const ROTATION_REFERENCE_WEEK = parseLocalDate('2026-10-19'); // a Cuaderno week

export function resolveStyle(setting: StyleSetting, today: LocalDate): VisualStyle {
  if (setting !== 'rotate') return setting;
  const weeks = diffDays(ROTATION_REFERENCE_WEEK, weekStart(today)) / 7;
  const index = ((weeks % ROTATION.length) + ROTATION.length) % ROTATION.length;
  return ROTATION[index] ?? 'cuaderno';
}
