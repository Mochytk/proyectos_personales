import { describe, expect, it } from 'vitest';
import { parseLocalDate as d } from '../dates/local-date';
import { anchorSchema, habitSchema, type Anchor, type Habit } from '../schemas/habits';
import { habitsForDay, isScheduledOn } from './schedule';

const NOW = '2026-10-23T15:00:00.000Z';
let counter = 0;
function uuid(): string {
  counter += 1;
  return `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`;
}

function anchor(
  name: string,
  sortOrder: number,
  overrides: Partial<Record<string, unknown>> = {},
): Anchor {
  return anchorSchema.parse({
    id: uuid(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    name,
    sortOrder,
    archivedAt: null,
    ...overrides,
  });
}

function habit(anchorId: string, overrides: Partial<Record<string, unknown>> = {}): Habit {
  return habitSchema.parse({
    id: uuid(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    name: 'Hábito',
    description: null,
    mode: 'daily',
    weeklyQuota: null,
    weekdays: [1, 2, 3, 4, 5, 6, 7],
    startsOn: '2026-10-01',
    anchorId,
    color: 'ink',
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  });
}

describe('isScheduledOn', () => {
  const weekdaysOnly = habit(uuid(), { weekdays: [1, 2, 3, 4, 5] });

  it('applies a Monday-to-Friday habit on a Friday', () => {
    expect(isScheduledOn(weekdaysOnly, d('2026-10-23'))).toBe(true);
  });

  it('does not apply a Monday-to-Friday habit on a Saturday', () => {
    expect(isScheduledOn(weekdaysOnly, d('2026-10-24'))).toBe(false);
  });

  it('applies a weekly quota habit every day, whatever its weekdays', () => {
    const weekly = habit(uuid(), { mode: 'weekly_quota', weeklyQuota: 3, weekdays: [1] });
    expect(isScheduledOn(weekly, d('2026-10-24'))).toBe(true);
  });

  it('does not apply before startsOn', () => {
    const later = habit(uuid(), { startsOn: '2026-10-23' });
    expect(isScheduledOn(later, d('2026-10-22'))).toBe(false);
    expect(isScheduledOn(later, d('2026-10-23'))).toBe(true);
  });
});

describe('habitsForDay', () => {
  it('groups by anchor in anchor order, then habit order, and drops empty anchors', () => {
    const night = anchor('Antes de dormir', 2);
    const morning = anchor('Al despertar', 0);
    const lunch = anchor('Después de almorzar', 1);
    const read = habit(night.id, { name: 'Leer', sortOrder: 1 });
    const call = habit(night.id, { name: 'Videollamada', sortOrder: 0 });
    const wake = habit(morning.id, { name: 'Despertar a la hora' });

    const groups = habitsForDay([read, wake, call], [night, lunch, morning], d('2026-10-23'));

    expect(groups.map((g) => g.anchor.name)).toEqual(['Al despertar', 'Antes de dormir']);
    expect(groups[1]?.habits.map((h) => h.name)).toEqual(['Videollamada', 'Leer']);
  });

  it('leaves out archived, deleted and unscheduled habits', () => {
    const morning = anchor('Al despertar', 0);
    const archived = habit(morning.id, { archivedAt: NOW });
    const deleted = habit(morning.id, { deletedAt: NOW });
    const weekdaysOnly = habit(morning.id, { weekdays: [1, 2, 3, 4, 5] });

    expect(habitsForDay([archived, deleted, weekdaysOnly], [morning], d('2026-10-24'))).toEqual([]);
  });

  it('still shows habits under an archived anchor, but not under a deleted one', () => {
    const archivedAnchor = anchor('Tarde', 0, { archivedAt: NOW });
    const deletedAnchor = anchor('Mañana', 1, { deletedAt: NOW });
    const underArchived = habit(archivedAnchor.id, { name: 'Caminar' });
    const underDeleted = habit(deletedAnchor.id, { name: 'Estirar' });

    const groups = habitsForDay(
      [underArchived, underDeleted],
      [archivedAnchor, deletedAnchor],
      d('2026-10-23'),
    );

    expect(groups.map((g) => g.anchor.name)).toEqual(['Tarde']);
  });
});
