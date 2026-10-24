import { sumEntries, type DayTotals } from './nutrition';
import type { FoodLogEntry, MealCategory } from './types';

/**
 * Meal category from local time of day, so one-tap logging needs no extra choice.
 * Small hours (before 05:00) count as a late snack, not breakfast.
 */
export function mealCategoryFor(date: Date): MealCategory {
  const h = date.getHours();
  if (h < 5) return 'snack';
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 17) return 'snack';
  if (h < 22) return 'dinner';
  return 'snack';
}

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  drink: 'Drink',
};

/** Every meal, in the order pickers and Summary show them. Drink is only ever picked, never chosen by the clock. */
export const MEAL_CATEGORIES: MealCategory[] = ['breakfast', 'lunch', 'dinner', 'snack', 'drink'];
const SECTION_LABELS: Record<MealCategory, string> = { ...MEAL_LABELS, snack: 'Snacks', drink: 'Drinks' };

export type MealSection = { category: MealCategory; label: string; entries: FoodLogEntry[]; totals: DayTotals };

/**
 * A day's entries as Breakfast, Lunch, Dinner, Snacks, Drinks, each with its own subtotal. Uses each entry's own
 * (editable) category, never the current time. Empty meals are left out; entries keep their order.
 */
export function groupByMeal(entries: FoodLogEntry[]): MealSection[] {
  return MEAL_CATEGORIES.flatMap((category) => {
    const inMeal = entries.filter((e) => e.mealCategory === category);
    if (inMeal.length === 0) return [];
    const totals = sumEntries(inMeal.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate })));
    return [{ category, label: SECTION_LABELS[category], entries: inMeal, totals }];
  });
}
