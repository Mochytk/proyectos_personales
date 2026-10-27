import { dailyStreak, weeklyStreak, weekStart, type LocalDate } from '@habit-tracker/shared';
import type { TodayRow } from './today-model';

function count(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

// The line under a habit on "Hoy": a skip and its reason, then the streak or the week's
// progress. Empty when there is nothing to say yet.
export function habitStats(row: TodayRow, today: LocalDate): string {
  const { habit, checkIn, statuses, quotaOverrides, progress } = row;
  const parts: string[] = [];

  if (checkIn?.status === 'skipped') {
    parts.push(checkIn.skipReason === null ? 'Saltado' : `Saltado: ${checkIn.skipReason}`);
  }

  if (progress === null) {
    const streak = dailyStreak({ habit, today, checkIns: statuses });
    if (streak > 0) parts.push(`Racha: ${count(streak, 'día', 'días')}`);
  } else {
    if (progress.quota === 0) parts.push('Semana en pausa');
    else if (progress.met) parts.push('Cumplido esta semana');
    else parts.push(`${String(progress.done)} de ${String(progress.quota)} esta semana`);
    const streak = weeklyStreak({
      habit,
      currentWeekStart: weekStart(today),
      checkIns: statuses,
      overrides: quotaOverrides,
    });
    if (streak > 0) parts.push(`Racha: ${count(streak, 'semana', 'semanas')}`);
  }

  return parts.join(' · ');
}
