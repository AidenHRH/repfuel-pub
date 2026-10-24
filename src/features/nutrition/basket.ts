import type { FoodLogEntry, MealCategory } from '@/domain/types';

/**
 * What's being logged in the open Log food flow ("Your lunch"): the entries added since it opened. They're saved as
 * they're added, so nothing is lost if the app closes mid-meal; Log N items finishes the meal. Closed (null) outside
 * Log food, so logging elsewhere (Summary's planned meal) works as before.
 */
let state: { meal: MealCategory; entries: FoodLogEntry[] } | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

export const basket = {
  open(meal: MealCategory) {
    state = { meal, entries: [] };
    notify();
  },
  close() {
    state = null;
    notify();
  },
  isOpen(): boolean {
    return state !== null;
  },
  meal(): MealCategory | null {
    return state?.meal ?? null;
  },
  setMeal(meal: MealCategory) {
    if (state) state = { ...state, meal };
    notify();
  },
  add(entry: FoodLogEntry) {
    if (!state) return;
    state = { ...state, entries: [...state.entries, entry] };
    notify();
  },
  remove(entryId: string) {
    if (!state) return;
    state = { ...state, entries: state.entries.filter((e) => e.id !== entryId) };
    notify();
  },
  /** Replaces an item after its amount was changed. */
  replace(entry: FoodLogEntry) {
    if (!state) return;
    state = { ...state, entries: state.entries.map((e) => (e.id === entry.id ? entry : e)) };
    notify();
  },
  items(): FoodLogEntry[] {
    return state?.entries ?? [];
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/** After adding something: back to the basket on Log food when it's open, else (logging from elsewhere) back out. */
export function finishAdd(router: { dismissAll(): void; dismissTo(href: '/log-food'): void }): void {
  if (basket.isOpen()) router.dismissTo('/log-food');
  else router.dismissAll();
}
