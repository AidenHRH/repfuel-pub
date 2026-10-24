import * as Haptics from 'expo-haptics';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { logTimeFor } from '@/domain/dayStatus';
import { mealCategoryFor } from '@/domain/meals';
import type { FoodLogEntry, MealCategory } from '@/domain/types';

import { basket } from './basket';

type NutritionEvent =
  | { type: 'changed' }
  | { type: 'logged'; entry: FoodLogEntry }
  /** A meal of several items finished from the basket: Summary offers Undo for all of them. */
  | { type: 'loggedMany'; entries: FoodLogEntry[] }
  | { type: 'deleted'; entry: FoodLogEntry };
type Listener = (event: NutritionEvent) => void;

const listeners = new Set<Listener>();

/** Lets any screen that changes food data tell Today (and others) to refresh. */
export const nutritionEvents = {
  emit(event: NutritionEvent) {
    listeners.forEach((listener) => listener(event));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Logs a saved food or meal, with a light tap of haptics, and tells Today to show it with Undo. */
/**
 * The day the open Log food flow is adding to (a past day opened from Summary), or null for today. Set by Log food
 * while it's open, so every way of adding inside it (search, scan, tiles, Build a meal) logs to that day.
 */
let loggingDay: string | null = null;

/** Sets the day while a Log food screen is open; the returned function puts back whatever was set before it. */
export function enterLoggingDay(day: string | null): () => void {
  const previous = loggingDay;
  loggingDay = day;
  return () => {
    loggingDay = previous;
  };
}

export async function logAndAnnounce(
  db: Db,
  item: { kind: 'food' | 'recipe'; id: string },
  amount: number,
  mealCategory?: MealCategory,
): Promise<FoodLogEntry> {
  const now = new Date();
  const meal = mealCategory ?? mealCategoryFor(now);
  return announce(await logLoggable(db, item, amount, logTimeFor(loggingDay ?? undefined, meal, now), meal));
}

/** Tells Today about an entry logged elsewhere (e.g. from the meal plan), with haptics and Undo. */
export function announce(entry: FoodLogEntry): FoodLogEntry {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  nutritionEvents.emit({ type: 'changed' });
  // Inside Log food the entry goes into the basket; Log N items announces the meal.
  if (basket.isOpen()) basket.add(entry);
  else nutritionEvents.emit({ type: 'logged', entry });
  return entry;
}

/** Finishes the basket's meal: Summary shows "Logged 2 items" with Undo for all. */
export function announceBasket(entries: FoodLogEntry[]): void {
  if (entries.length === 1) nutritionEvents.emit({ type: 'logged', entry: entries[0] });
  else if (entries.length > 1) nutritionEvents.emit({ type: 'loggedMany', entries });
}
