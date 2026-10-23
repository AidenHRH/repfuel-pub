import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/database/DatabaseProvider';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { getCurrentTargets } from '@/database/repositories/targetsRepository';
import { localDayKey } from '@/domain/dates';
import { sumEntries, type DayTotals } from '@/domain/nutrition';
import type { FoodLogEntry, NutritionTargets } from '@/domain/types';

import { nutritionEvents } from './events';

export type DayLog = { day: string; entries: FoodLogEntry[]; totals: DayTotals; targets: NutritionTargets };

/** Today's entries and totals from the database. Follows the local day across midnight and app resumes. */
export function useDayLog(): DayLog | 'error' | null {
  const db = useDb();
  const [day, setDay] = useState(() => localDayKey(new Date()));
  const [version, setVersion] = useState(0);
  const [log, setLog] = useState<DayLog | 'error' | null>(null);

  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([entriesForDay(db, day), getCurrentTargets(db)]).then(
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
  }, [day]);

  if (log === 'error') return log;
  return log && log.day === day ? log : null;
}
