import { newId, nowIso } from '../ids';

import type { Migration } from './index';

// Timestamps are ISO-8601 UTC text. Food log rows also keep the device-local
// calendar day (local_day, YYYY-MM-DD) so daily totals never shift with time zones.
// Nutrient columns are nullable: NULL means "unknown", never zero.
const SCHEMA = `
CREATE TABLE user_profile (
  id TEXT PRIMARY KEY NOT NULL,
  age INTEGER NOT NULL CHECK (age > 0),
  height_cm REAL NOT NULL CHECK (height_cm > 0),
  current_weight_kg REAL NOT NULL CHECK (current_weight_kg > 0),
  body_fat_percentage REAL CHECK (body_fat_percentage IS NULL OR (body_fat_percentage >= 0 AND body_fat_percentage < 100)),
  body_fat_is_estimate INTEGER NOT NULL DEFAULT 1 CHECK (body_fat_is_estimate IN (0, 1)),
  primary_goal TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE nutrition_targets (
  id TEXT PRIMARY KEY NOT NULL,
  calories_kcal REAL NOT NULL CHECK (calories_kcal > 0),
  protein_grams REAL NOT NULL CHECK (protein_grams >= 0),
  carbohydrates_grams REAL CHECK (carbohydrates_grams IS NULL OR carbohydrates_grams >= 0),
  fat_grams REAL CHECK (fat_grams IS NULL OR fat_grams >= 0),
  -- Full ISO timestamps only, so text order is time order.
  effective_from TEXT NOT NULL CHECK (effective_from GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]*Z'),
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_nutrition_targets_effective ON nutrition_targets (effective_from);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE food_product (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT UNIQUE,
  basis TEXT NOT NULL CHECK (basis IN ('per_serving', 'per_100g', 'per_100ml')),
  serving_size REAL CHECK (serving_size IS NULL OR serving_size > 0),
  serving_unit TEXT,
  kcal REAL CHECK (kcal IS NULL OR kcal >= 0),
  protein_g REAL CHECK (protein_g IS NULL OR protein_g >= 0),
  carbs_g REAL CHECK (carbs_g IS NULL OR carbs_g >= 0),
  fat_g REAL CHECK (fat_g IS NULL OR fat_g >= 0),
  fibre_g REAL CHECK (fibre_g IS NULL OR fibre_g >= 0),
  data_source TEXT NOT NULL CHECK (data_source IN ('open_food_facts', 'manual', 'user_approximate', 'card_scan')),
  ingredients_text TEXT,
  notes TEXT,
  is_favourite INTEGER NOT NULL DEFAULT 0 CHECK (is_favourite IN (0, 1)),
  last_verified_at TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE recipe (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  portions_made REAL NOT NULL DEFAULT 1 CHECK (portions_made > 0),
  notes TEXT,
  is_favourite INTEGER NOT NULL DEFAULT 0 CHECK (is_favourite IN (0, 1)),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE recipe_ingredient (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
  food_product_id TEXT NOT NULL REFERENCES food_product (id),
  amount REAL NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'serving')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_recipe_ingredient_recipe ON recipe_ingredient (recipe_id);

CREATE TABLE food_log_entry (
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
  meal_category TEXT NOT NULL CHECK (meal_category IN ('breakfast', 'lunch', 'dinner', 'snack')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_food_log_entry_day ON food_log_entry (local_day);

CREATE TABLE exercise (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL CHECK (muscle_group IN ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'core', 'full_body', 'other')),
  equipment TEXT NOT NULL CHECK (equipment IN ('barbell', 'dumbbell', 'cable', 'machine', 'ez_bar', 'bodyweight', 'kettlebell', 'band', 'other')),
  is_bodyweight INTEGER NOT NULL DEFAULT 0 CHECK (is_bodyweight IN (0, 1)),
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  wger_exercise_id INTEGER,
  archived_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE workout_template (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  rotation_position INTEGER,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE template_exercise (
  id TEXT PRIMARY KEY NOT NULL,
  template_id TEXT NOT NULL REFERENCES workout_template (id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercise (id),
  sort_order INTEGER NOT NULL,
  target_sets INTEGER CHECK (target_sets IS NULL OR target_sets > 0),
  target_rep_range TEXT,
  notes TEXT
);
CREATE INDEX idx_template_exercise_template ON template_exercise (template_id);

CREATE TABLE workout (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  source_template_id TEXT REFERENCES workout_template (id) ON DELETE SET NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_workout_started ON workout (started_at);

CREATE TABLE workout_exercise (
  id TEXT PRIMARY KEY NOT NULL,
  workout_id TEXT NOT NULL REFERENCES workout (id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL REFERENCES exercise (id),
  sort_order INTEGER NOT NULL,
  notes TEXT
);
CREATE INDEX idx_workout_exercise_workout ON workout_exercise (workout_id);
CREATE INDEX idx_workout_exercise_exercise ON workout_exercise (exercise_id);

CREATE TABLE workout_set (
  id TEXT PRIMARY KEY NOT NULL,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercise (id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number > 0),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
  repetitions INTEGER CHECK (repetitions IS NULL OR repetitions >= 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  effort INTEGER CHECK (effort IS NULL OR (effort BETWEEN 1 AND 10)),
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK (is_completed IN (0, 1)),
  notes TEXT
);
CREATE INDEX idx_workout_set_exercise ON workout_set (workout_exercise_id);

CREATE TABLE personal_record (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_id TEXT NOT NULL REFERENCES exercise (id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('heaviest_weight', 'most_reps_at_weight', 'estimated_1rm', 'longest_duration', 'most_reps_bodyweight')),
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  reference_weight_kg REAL,
  achieved_at TEXT NOT NULL,
  source_workout_id TEXT REFERENCES workout (id) ON DELETE CASCADE
);
CREATE INDEX idx_personal_record_exercise ON personal_record (exercise_id);

CREATE TABLE body_measurement (
  id TEXT PRIMARY KEY NOT NULL,
  measured_at TEXT NOT NULL,
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg > 0),
  body_fat_percentage REAL CHECK (body_fat_percentage IS NULL OR (body_fat_percentage >= 0 AND body_fat_percentage < 100)),
  body_fat_is_estimate INTEGER NOT NULL DEFAULT 1 CHECK (body_fat_is_estimate IN (0, 1)),
  source TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_body_measurement_measured ON body_measurement (measured_at);
`;

export const initial: Migration = {
  version: 1,
  name: 'initial schema and starting profile',
  async up(db) {
    await db.exec(SCHEMA);

    const now = nowIso();
    // Placeholder values until the welcome setup asks for the person's own (0.20). Changed from the original
    // personal values when RepFuel was shared: phones that already ran this migration keep their own data.
    await db.run(
      `INSERT INTO user_profile (id, age, height_cm, current_weight_kg, body_fat_percentage, body_fat_is_estimate, primary_goal, created_at, updated_at)
       VALUES (?, 30, 175, 75, NULL, 1, 'Not set yet', ?, ?)`,
      [newId(), now, now],
    );
    await db.run(
      `INSERT INTO nutrition_targets (id, calories_kcal, protein_grams, carbohydrates_grams, fat_grams, effective_from, updated_at)
       VALUES (?, 2500, 145, NULL, NULL, ?, ?)`,
      [newId(), now, now],
    );
  },
};
