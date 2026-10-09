import { describe, expect, it } from 'vitest';
import { bucketFor, fromInputs, reminderTime, toDateInput, toTimeInput } from '../store/dates';

describe('fromInputs / toDateInput / toTimeInput', () => {
  it('round-trips a date without time as local midnight', () => {
    const due = fromInputs('2026-10-09', '')!;
    expect(due.dueHasTime).toBe(false);
    expect(toDateInput(due.dueDate)).toBe('2026-10-09');
    expect(toTimeInput(due.dueDate, due.dueHasTime)).toBe('');
  });

  it('round-trips a date with time', () => {
    const due = fromInputs('2026-10-09', '14:30')!;
    expect(due.dueHasTime).toBe(true);
    expect(toTimeInput(due.dueDate, true)).toBe('14:30');
  });

  it('rejects empty, partial and impossible dates', () => {
    expect(fromInputs('', '10:00')).toBeUndefined();
    expect(fromInputs('2026-1', '')).toBeUndefined();
    expect(fromInputs('2026-02-31', '')).toBeUndefined();
  });

  it('ignores an invalid time but keeps the date', () => {
    expect(fromInputs('2026-10-09', '25:00')?.dueHasTime).toBe(false);
  });
});

describe('reminderTime', () => {
  it('uses the exact time when there is one', () => {
    const due = fromInputs('2026-10-09', '14:30')!;
    expect(reminderTime({ ...due, remind: true })).toBe(due.dueDate);
  });

  it('fires at 09:00 for date-only items', () => {
    const due = fromInputs('2026-10-09', '')!;
    expect(new Date(reminderTime({ ...due, remind: true })!).getHours()).toBe(9);
  });

  it('returns undefined without a reminder or a date', () => {
    expect(reminderTime({ dueDate: 1, remind: false })).toBeUndefined();
    expect(reminderTime({ remind: true })).toBeUndefined();
  });
});

describe('bucketFor', () => {
  const now = new Date(2026, 9, 9, 15, 0).getTime();
  const bucket = (date: string, time = '') => bucketFor(fromInputs(date, time)!, now);

  it('groups relative to today', () => {
    expect(bucket('2026-10-08')).toBe('overdue');
    expect(bucket('2026-10-09')).toBe('today');
    expect(bucket('2026-10-10')).toBe('tomorrow');
    expect(bucket('2026-10-16')).toBe('week');
    expect(bucket('2026-10-17')).toBe('later');
    expect(bucketFor({}, now)).toBe('undated');
  });

  it('a date-only item is not overdue until its day ends, a timed one is once the hour passes', () => {
    expect(bucket('2026-10-09')).toBe('today');
    expect(bucket('2026-10-09', '10:00')).toBe('overdue');
    expect(bucket('2026-10-09', '18:00')).toBe('today');
  });
});
