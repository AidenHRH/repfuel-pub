import * as Haptics from 'expo-haptics';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import type { FoodLogEntry, MealCategory } from '@/domain/types';

type NutritionEvent = { type: 'changed' } | { type: 'logged'; entry: FoodLogEntry } | { type: 'deleted'; entry: FoodLogEntry };
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
export async function logAndAnnounce(
  db: Db,
  item: { kind: 'food' | 'recipe'; id: string },
  amount: number,
  mealCategory?: MealCategory,
): Promise<FoodLogEntry> {
  return announce(await logLoggable(db, item, amount, new Date(), mealCategory));
}

/** Tells Today about an entry logged elsewhere (e.g. from the meal plan), with haptics and Undo. */
export function announce(entry: FoodLogEntry): FoodLogEntry {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  nutritionEvents.emit({ type: 'changed' });
  nutritionEvents.emit({ type: 'logged', entry });
  return entry;
}
