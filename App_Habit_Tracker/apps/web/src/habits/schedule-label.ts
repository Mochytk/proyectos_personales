import type { Habit, IsoWeekday } from '@habit-tracker/shared';

export const WEEKDAYS: readonly { day: IsoWeekday; name: string; short: string }[] = [
  { day: 1, name: 'Lunes', short: 'Lun' },
  { day: 2, name: 'Martes', short: 'Mar' },
  { day: 3, name: 'Miércoles', short: 'Mié' },
  { day: 4, name: 'Jueves', short: 'Jue' },
  { day: 5, name: 'Viernes', short: 'Vie' },
  { day: 6, name: 'Sábado', short: 'Sáb' },
  { day: 7, name: 'Domingo', short: 'Dom' },
];

const list = new Intl.ListFormat('es-CL', { type: 'conjunction' });

// "Todos los días", "Lun, Mié y Vie" or "3 veces por semana".
export function scheduleLabel(habit: Pick<Habit, 'mode' | 'weeklyQuota' | 'weekdays'>): string {
  if (habit.mode === 'weekly_quota') {
    const quota = habit.weeklyQuota ?? 0;
    return quota === 1 ? '1 vez por semana' : `${String(quota)} veces por semana`;
  }
  if (habit.weekdays.length === 7) return 'Todos los días';
  return list.format(
    WEEKDAYS.filter(({ day }) => habit.weekdays.includes(day)).map(({ short }) => short),
  );
}
