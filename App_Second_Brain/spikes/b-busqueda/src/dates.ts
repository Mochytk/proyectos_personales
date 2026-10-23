// Relative dates in Chilean Spanish questions ("ayer", "la semana pasada"...), resolved against a
// reference day. Weeks start on Monday. Returns the phrase so it can be removed from the query.

export interface DateRange {
  from: string; // inclusive, YYYY-MM-DD
  to: string; // inclusive, YYYY-MM-DD
  phrase: string;
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): Date {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function relativeRange(question: string, refDay: string): DateRange | null {
  const text = question.toLowerCase();
  const weekday = (new Date(`${refDay}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = Monday
  const rules: [RegExp, () => [Date, Date]][] = [
    [/\banteayer\b/, () => [addDays(refDay, -2), addDays(refDay, -2)]],
    [/\bayer\b/, () => [addDays(refDay, -1), addDays(refDay, -1)]],
    [/\bhoy\b/, () => [addDays(refDay, 0), addDays(refDay, 0)]],
    [/\b(la )?semana pasada\b/, () => [addDays(refDay, -weekday - 7), addDays(refDay, -weekday - 1)]],
    [/\besta semana\b/, () => [addDays(refDay, -weekday), addDays(refDay, 0)]],
  ];
  for (const [pattern, range] of rules) {
    const match = pattern.exec(text);
    if (match) {
      const [from, to] = range();
      return { from: day(from), to: day(to), phrase: match[0] };
    }
  }
  return null;
}

export function inRange(createdAt: string, range: DateRange): boolean {
  const local = createdAt.slice(0, 10); // created_at already carries the America/Santiago offset
  return local >= range.from && local <= range.to;
}
