import type { Db } from '../Db';

import { initial } from './001_initial';
import { recipeComponents } from './002_recipe_components';
import { barcodeCache } from './003_barcode_cache';
import { exerciseLibrary } from './004_exercise_library';
import { snacksRow } from './005_snacks_row';
import { foodImages } from './006_food_images';
import { foodPresets } from './007_food_presets';
import { reminders } from './008_reminders';
import { foodHealth } from './009_food_health';
import { mealPlan } from './010_meal_plan';
import { workoutKinds } from './011_workout_kinds';
import { drinks } from './012_drinks';
import { packSize } from './013_pack_size';
import { creatineAmounts } from './014_creatine_amounts';
import { assistedReps } from './015_assisted_reps';
import { exerciseVideo } from './016_exercise_video';
import { recipePhoto } from './017_recipe_photo';
import { setupDone } from './018_setup_done';

export type Migration = {
  version: number;
  name: string;
  up(db: Db): Promise<void>;
};

/** Ordered by version. Never edit a shipped migration; add a new one. */
export const allMigrations: Migration[] = [
  initial,
  recipeComponents,
  barcodeCache,
  exerciseLibrary,
  snacksRow,
  foodImages,
  foodPresets,
  reminders,
  foodHealth,
  mealPlan,
  workoutKinds,
  drinks,
  packSize,
  creatineAmounts,
  assistedReps,
  exerciseVideo,
  recipePhoto,
  setupDone,
];
