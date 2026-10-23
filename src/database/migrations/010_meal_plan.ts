import type { Migration } from './index';

// A week's meal plan (one row per day and meal) and the shopping list's ticks.
export const mealPlan: Migration = {
  version: 10,
  name: 'meal_plan',
  async up(db) {
    await db.exec(`
CREATE TABLE meal_plan (
  local_day TEXT NOT NULL CHECK (local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  slot TEXT NOT NULL CHECK (slot IN ('breakfast', 'lunch', 'dinner', 'snack')),
  item_kind TEXT NOT NULL CHECK (item_kind IN ('template', 'recipe')),
  item_id TEXT NOT NULL,
  portions REAL NOT NULL CHECK (portions > 0),
  logged_entry_id TEXT,
  PRIMARY KEY (local_day, slot)
);
CREATE TABLE shopping_tick (
  item_key TEXT PRIMARY KEY NOT NULL,
  ticked_at TEXT NOT NULL
);
`);
  },
};
