import {
  addDays,
  habitsForDay,
  weeklyProgress,
  weekStart,
  type Anchor,
  type CheckIn,
  type CheckInStatus,
  type Habit,
  type LocalDate,
  type WeeklyQuotaOverride,
} from '@habit-tracker/shared';

export interface TodayData {
  habits: Habit[];
  anchors: Anchor[];
  checkIns: CheckIn[];
  overrides: WeeklyQuotaOverride[];
}

export interface TodayRow {
  habit: Habit;
  // Today's live check-in, if any.
  checkIn: CheckIn | undefined;
  // Every live check-in of the habit, by date.
  statuses: ReadonlyMap<LocalDate, CheckInStatus>;
  quotaOverrides: ReadonlyMap<LocalDate, number>;
  progress: { done: number; quota: number; met: boolean } | null;
}

export interface TodayGroup {
  anchor: Anchor;
  // 1-based position in the anchor list, for the style palettes (ADR 0009).
  colorIndex: number;
  rows: TodayRow[];
}

export type DayState = 'complete' | 'partial' | 'missed' | 'pending' | 'rest' | 'future';

export interface TodayModel {
  hasHabits: boolean;
  groups: TodayGroup[];
  week: { date: LocalDate; state: DayState }[];
}

const PALETTE_SIZE = 4;

export function isResolved(row: Pick<TodayRow, 'checkIn'>): boolean {
  return row.checkIn !== undefined;
}

export function buildToday(data: TodayData, today: LocalDate): TodayModel {
  const checkIns = new Map<string, Map<LocalDate, CheckIn>>();
  for (const checkIn of data.checkIns) {
    if (checkIn.deletedAt !== null) continue;
    const byDate = checkIns.get(checkIn.habitId) ?? new Map<LocalDate, CheckIn>();
    byDate.set(checkIn.localDate, checkIn);
    checkIns.set(checkIn.habitId, byDate);
  }
  const overrides = new Map<string, Map<LocalDate, number>>();
  for (const override of data.overrides) {
    if (override.deletedAt !== null) continue;
    const byWeek = overrides.get(override.habitId) ?? new Map<LocalDate, number>();
    byWeek.set(override.weekStart, override.quota);
    overrides.set(override.habitId, byWeek);
  }
  const statusesOf = (habitId: string): Map<LocalDate, CheckInStatus> =>
    new Map(
      [...(checkIns.get(habitId) ?? new Map<LocalDate, CheckIn>())].map(([d, c]) => [d, c.status]),
    );

  const anchorOrder = data.anchors
    .filter((anchor) => anchor.deletedAt === null)
    .toSorted((a, b) => a.sortOrder - b.sortOrder)
    .map((anchor) => anchor.id);
  const thisWeek = weekStart(today);

  const groups = habitsForDay(data.habits, data.anchors, today).map(({ anchor, habits }) => ({
    anchor,
    colorIndex: (anchorOrder.indexOf(anchor.id) % PALETTE_SIZE) + 1,
    rows: habits.map((habit): TodayRow => {
      const statuses = statusesOf(habit.id);
      const quotaOverrides = overrides.get(habit.id) ?? new Map<LocalDate, number>();
      return {
        habit,
        checkIn: checkIns.get(habit.id)?.get(today),
        statuses,
        quotaOverrides,
        progress:
          habit.mode === 'weekly_quota'
            ? weeklyProgress({
                habit,
                weekStart: thisWeek,
                checkIns: statuses,
                overrides: quotaOverrides,
              })
            : null,
      };
    }),
  }));

  const week = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(thisWeek, offset);
    return { date, state: dayState(data, checkIns, date, today) };
  });

  return {
    hasHabits: data.habits.some((habit) => habit.deletedAt === null && habit.archivedAt === null),
    groups,
    week,
  };
}

function dayState(
  data: TodayData,
  checkIns: Map<string, Map<LocalDate, CheckIn>>,
  date: LocalDate,
  today: LocalDate,
): DayState {
  if (date > today) return 'future';
  const habits = habitsForDay(data.habits, data.anchors, date).flatMap((group) => group.habits);
  if (habits.length === 0) return 'rest';
  const marks = habits.map((habit) => checkIns.get(habit.id)?.get(date));
  if (marks.every((mark) => mark !== undefined)) return 'complete';
  if (marks.some((mark) => mark?.status === 'done')) return 'partial';
  return date === today ? 'pending' : 'missed';
}
