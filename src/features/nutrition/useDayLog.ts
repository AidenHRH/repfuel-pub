import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/database/DatabaseProvider';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { targetsOn } from '@/database/repositories/targetsRepository';
import { localDayKey } from '@/domain/dates';
import { sumEntries, type DayTotals } from '@/domain/nutrition';
import type { FoodLogEntry, NutritionTargets } from '@/domain/types';

import { nutritionEvents } from './events';

const endOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
};

export type DayLog = { day: string; entries: FoodLogEntry[]; totals: DayTotals; targets: NutritionTargets };

/**
 * A day's entries and totals from the database: `forDay`, or today, following the local day across midnight and app
 * resumes.
 */
export function useDayLog(forDay?: string | null): DayLog | 'error' | null {
  const db = useDb();
  const [today, setDay] = useState(() => localDayKey(new Date()));
  const day = forDay ?? today;
  const [version, setVersion] = useState(0);
  const [log, setLog] = useState<DayLog | 'error' | null>(null);

  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([entriesForDay(db, day), targetsOn(db, endOf(day))]).then(
      ([entries, targets]) => {
        if (cancelled) return;
        const totals = sumEntries(entries.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate })));
        setLog({ day, entries, totals, targets });
      },
      () => {
        if (!cancelled) setLog('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, day, version]);

  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 1, 0);
    const timer = setTimeout(() => setDay(localDayKey(new Date())), nextMidnight.getTime() - now.getTime());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setDay(localDayKey(new Date()));
      setVersion((v) => v + 1);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, [today]);

  if (log === 'error') return log;
  return log && log.day === day ? log : null;
}
