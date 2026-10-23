import { COMMON_FOODS } from '@/domain/commonFoods';

import type { Migration } from './index';

const DRINK_PRESETS = COMMON_FOODS.filter((f) => f.group === 'Drinks').map((f) => f.id);

// Drink becomes its own meal (the diary table is rebuilt to allow it, keeping every entry), with its own tile row.
export const drinks: Migration = {
  version: 12,
  name: 'drinks',
  async up(db) {
    await db.exec(`
CREATE TABLE food_log_entry_new (
  id TEXT PRIMARY KEY NOT NULL,
  food_product_id TEXT REFERENCES food_product (id) ON DELETE SET NULL,
  recipe_id TEXT REFERENCES recipe (id) ON DELETE SET NULL,
  food_name_snapshot TEXT NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'serving', 'portion')),
  kcal REAL CHECK (kcal IS NULL OR kcal >= 0),
  protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g REAL CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  fibre_g REAL CHECK (fibre_g IS NULL OR fibre_g >= 0),
  is_approximate INTEGER NOT NULL DEFAULT 0 CHECK (is_approximate IN (0, 1)),
  logged_at TEXT NOT NULL,
  local_day TEXT NOT NULL CHECK (local_day GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  meal_category TEXT NOT NULL CHECK (meal_category IN ('breakfast', 'lunch', 'dinner', 'snack', 'drink')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO food_log_entry_new SELECT id, food_product_id, recipe_id, food_name_snapshot, amount, unit, kcal, protein_g,
  carbs_g, fat_g, fibre_g, is_approximate, logged_at, local_day, meal_category, notes, created_at, updated_at FROM food_log_entry;
DROP TABLE food_log_entry;
ALTER TABLE food_log_entry_new RENAME TO food_log_entry;
CREATE INDEX idx_food_log_entry_day ON food_log_entry (local_day);
ALTER TABLE food_product ADD COLUMN in_drinks_row INTEGER NOT NULL DEFAULT 0 CHECK (in_drinks_row IN (0, 1));
`);
    const presets = DRINK_PRESETS.map(() => '?').join(', ');
    await db.run(
      `UPDATE food_product SET in_drinks_row = 1, in_snacks_row = 0
       WHERE in_snacks_row = 1 AND (basis = 'per_100ml' OR preset_id IN (${presets}))`,
      DRINK_PRESETS,
    );
  },
};
