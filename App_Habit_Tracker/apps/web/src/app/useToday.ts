import { toLocalDate, type LocalDate } from '@habit-tracker/shared';
import { useEffect, useState } from 'react';
import { useSettings } from '../settings/useSettings';

const RECHECK_MS = 60_000;

// The local date right now (ADR 0007), kept current: every minute, and as soon as the
// app comes back to the front, so "Hoy" rolls over at the cutoff without a reload.
export function useLocalDate(timeZone: string, cutoffHour: number): LocalDate {
  const [today, setToday] = useState(() => toLocalDate(new Date(), timeZone, cutoffHour));

  useEffect(() => {
    const refresh = () => {
      setToday(toLocalDate(new Date(), timeZone, cutoffHour));
    };
    refresh();
    const timer = setInterval(refresh, RECHECK_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [timeZone, cutoffHour]);

  return today;
}

export function useToday(): LocalDate {
  const { timeZone, dayCutoffHour } = useSettings();
  return useLocalDate(timeZone, dayCutoffHour);
}
