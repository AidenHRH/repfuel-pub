import { dayStatus, MAIN_MEALS, type DayStage } from '@/domain/dayStatus';
import { localDayKey } from '@/domain/dates';
import type { FoodLogEntry, MealCategory, NutritionTargets } from '@/domain/types';

import type { Db } from '../Db';
import { newId } from '../ids';

import { entriesForDay, getEntry, restoreEntry } from './foodLogRepository';
import { getSetting, setSetting } from './settingsRepository';
import { targetsOn } from './targetsRepository';

/** Meals marked "skipped", by day, so a day without breakfast can still be fully logged. */
type Skipped = Record<string, MealCategory[]>;

export async function skippedMeals(db: Db, day: string): Promise<MealCategory[]> {
  return (await getSetting<Skipped>(db, 'skipped', {}))[day] ?? [];
}

export async function setSkipped(db: Db, day: string, meal: MealCategory, on: boolean): Promise<void> {
  if (!MAIN_MEALS.includes(meal)) return;
  const all = await getSetting<Skipped>(db, 'skipped', {});
  const next = new Set(all[day] ?? []);
  if (on) next.add(meal);
  else next.delete(meal);
  all[day] = MAIN_MEALS.filter((m) => next.has(m));
  if (all[day].length === 0) delete all[day];
  await setSetting(db, 'skipped', all);
}

export type DaySummary = {
  day: string;
  entries: FoodLogEntry[];
  targets: NutritionTargets;
  skipped: MealCategory[];
  status: { stage: DayStage; mealsDone: number };
};

const endOf = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59);
};

/** Each day's entries, the targets in effect that day, skipped meals and its stage. */
export async function daySummaries(db: Db, days: string[]): Promise<DaySummary[]> {
  const skipped = await getSetting<Skipped>(db, 'skipped', {});
  return Promise.all(
    days.map(async (day) => {
      const [entries, targets] = await Promise.all([entriesForDay(db, day), targetsOn(db, endOf(day))]);
      const s = skipped[day] ?? [];
      return { day, entries, targets, skipped: s, status: dayStatus(entries, targets, s) };
    }),
  );
}

/** Logs an entry again, with the same food and amounts, into `meal` at `now`. */
export async function logAgain(db: Db, entryId: string, meal: MealCategory, now: Date = new Date()): Promise<FoodLogEntry> {
  const original = await getEntry(db, entryId);
  if (!original) throw new Error('That entry isn’t there any more');
  const copy: FoodLogEntry = {
    ...original,
    id: newId(),
    loggedAt: now.toISOString(),
    localDay: localDayKey(now),
    mealCategory: meal,
  };
  await restoreEntry(db, copy);
  return copy;
}
