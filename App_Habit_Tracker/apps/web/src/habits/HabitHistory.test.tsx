import { parseLocalDate, type CheckIn, type Habit } from '@habit-tracker/shared';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HabitHistory } from './HabitHistory';

const NOW = '2026-10-23T15:00:00.000Z';
const TODAY = parseLocalDate('2026-10-23'); // a Friday

const HABIT: Pick<Habit, 'id' | 'mode' | 'weekdays' | 'startsOn'> = {
  id: '0d6c3c2e-6b1f-4a5e-9a3e-1f2b3c4d5e6f',
  mode: 'daily',
  weekdays: [1, 2, 3, 4, 5],
  startsOn: parseLocalDate('2026-10-01'),
};

function checkIn(
  date: string,
  status: CheckIn['status'],
  skipReason: CheckIn['skipReason'] = null,
) {
  return {
    id: crypto.randomUUID(),
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    habitId: HABIT.id,
    localDate: parseLocalDate(date),
    status,
    skipReason,
    note: null,
    value: null,
  } satisfies CheckIn;
}

describe('HabitHistory', () => {
  it('draws 90 days on a Monday-first grid, each with an accessible label', () => {
    render(
      <HabitHistory
        habit={HABIT}
        today={TODAY}
        checkIns={[checkIn('2026-10-23', 'done'), checkIn('2026-10-22', 'skipped', 'certamen')]}
      />,
    );

    const grid = screen.getByRole('list', { name: 'Últimos 90 días' });
    const days = within(grid).getAllByRole('listitem');
    expect(days).toHaveLength(90);
    expect(days.at(-1)?.getAttribute('aria-label')).toBe('vie 23-10: hecho');
    expect(days.at(-2)?.getAttribute('aria-label')).toBe('jue 22-10: saltado (certamen)');
    expect(days.at(-3)?.getAttribute('aria-label')).toBe('mié 21-10: no hecho');
    expect(days.at(-6)?.getAttribute('aria-label')).toBe('dom 18-10: no aplica');
    expect(days[0]?.getAttribute('aria-label')).toBe('dom 26-07: antes de empezar');

    // 26-07-2026 is a Sunday: it sits in the seventh column, after six blank cells.
    expect(days[0]?.style.gridColumnStart).toBe('7');
    const header = screen.getByTestId('heatmap-weekdays').textContent;
    expect(header).toBe('LMXJVSD');
  });
});
