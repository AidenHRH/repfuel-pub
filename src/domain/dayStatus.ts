import { localDayKey } from './dates';
import type { FoodLogEntry, MealCategory, NutritionTargets } from './types';

/** How a day went, for its dot: nothing logged, under way, fully logged but goals missed, or goals hit. */
export type DayStage = 'empty' | 'partial' | 'missed' | 'hit';

/** The meals that make a day "fully logged"; snacks and drinks are extras. */
export const MAIN_MEALS: MealCategory[] = ['breakfast', 'lunch', 'dinner'];

/** Calories count as on target within this share of the target, either side. */
export const KCAL_TOLERANCE = 0.1;

const sum = (entries: FoodLogEntry[], key: 'kcal' | 'proteinG'): number | null => {
  let total = 0;
  for (const e of entries) {
    const v = e.nutrients[key];
    if (v === null) return null;
    total += v;
  }
  return total;
};

/** True when protein reaches its target and calories are within ±10% (unknown values never count as on target). */
export function goalsHit(entries: FoodLogEntry[], targets: Pick<NutritionTargets, 'caloriesKcal' | 'proteinGrams'>): boolean {
  const kcal = sum(entries, 'kcal');
  const protein = sum(entries, 'proteinG');
  if (kcal === null || protein === null) return false;
  return protein >= targets.proteinGrams && Math.abs(kcal - targets.caloriesKcal) <= targets.caloriesKcal * KCAL_TOLERANCE;
}

/** A day's stage and how many of breakfast, lunch and dinner are done (logged, or marked skipped). */
export function dayStatus(
  entries: FoodLogEntry[],
  targets: Pick<NutritionTargets, 'caloriesKcal' | 'proteinGrams'>,
  skipped: MealCategory[],
): { stage: DayStage; mealsDone: number } {
  const mealsDone = MAIN_MEALS.filter((m) => skipped.includes(m) || entries.some((e) => e.mealCategory === m)).length;
  if (entries.length === 0 && mealsDone === 0) return { stage: 'empty', mealsDone };
  if (mealsDone < MAIN_MEALS.length) return { stage: 'partial', mealsDone };
  return { stage: goalsHit(entries, targets) ? 'hit' : 'missed', mealsDone };
}

const dayBefore = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return localDayKey(new Date(y, m - 1, d - 1, 12));
};

/** Goal-hit days in a row up to today (today counts once hit; until then the streak runs to yesterday). */
export function streak(stages: Record<string, DayStage>, today: string): number {
  let day = stages[today] === 'hit' ? today : dayBefore(today);
  let count = 0;
  while (stages[day] === 'hit') {
    count += 1;
    day = dayBefore(day);
  }
  return count;
}

/** Liquid calories: every entry measured in ml, in whatever meal it was logged. */
export function drinksSummary(entries: FoodLogEntry[]): { count: number; kcal: number; entries: FoodLogEntry[] } {
  const drinks = entries.filter((e) => e.unit === 'ml');
  return { count: drinks.length, kcal: Math.round(drinks.reduce((t, e) => t + (e.nutrients.kcal ?? 0), 0)), entries: drinks };
}

/** When a meal's usual time is, for logging on a past day. */
const USUAL_TIME: Record<MealCategory, [number, number]> = {
  breakfast: [8, 0],
  lunch: [12, 30],
  snack: [15, 30],
  dinner: [18, 30],
  drink: [12, 0],
};

/** The time to log at: now for today (or no day given), else that day at the meal's usual time. */
export function logTimeFor(day: string | undefined, meal: MealCategory, now: Date = new Date()): Date {
  if (!day || day === localDayKey(now)) return now;
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = USUAL_TIME[meal];
  return new Date(y, m - 1, d, h, min);
}
