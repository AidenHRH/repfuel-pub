import { useEffect, useState } from 'react';

import { useDb } from '@/database/DatabaseProvider';
import { getPlan, logPlannedMeal, planDayKeys } from '@/database/repositories/mealPlanRepository';
import type { MealCategory } from '@/domain/types';
import { announce, nutritionEvents } from '@/features/nutrition/events';
import { safely } from '@/features/safely';

import type { PlannedMeal } from './MealList';

/** Today's planned dishes not logged yet, by meal, each with a one-tap Log; none on other days. */
export function usePlanned(isToday: boolean): Partial<Record<MealCategory, PlannedMeal>> {
  const db = useDb();
  const [planned, setPlanned] = useState<Partial<Record<MealCategory, PlannedMeal>>>({});
  const [version, setVersion] = useState(0);
  useEffect(() => nutritionEvents.subscribe(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    let cancelled = false;
    if (!isToday) return;
    const [day] = planDayKeys(new Date(), 1);
    getPlan(db, [day]).then(
      ([today]) => {
        if (cancelled) return;
        const next: Partial<Record<MealCategory, PlannedMeal>> = {};
        for (const m of today?.meals ?? [])
          if (!m.logged)
            next[m.slot] = {
              name: m.name,
              onLog: () => void safely('log this meal', async () => announce(await logPlannedMeal(db, day, m.slot))),
            };
        setPlanned(next);
      },
      () => !cancelled && setPlanned({}),
    );
    return () => {
      cancelled = true;
    };
  }, [db, isToday, version]);
  return isToday ? planned : {};
}
