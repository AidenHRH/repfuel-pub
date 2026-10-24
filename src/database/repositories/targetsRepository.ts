import type { NutritionTargets } from '@/domain/types';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

type Row = {
  id: string;
  calories_kcal: number;
  protein_grams: number;
  carbohydrates_grams: number | null;
  fat_grams: number | null;
  effective_from: string;
  updated_at: string;
};

function toTargets(row: Row): NutritionTargets {
  return {
    id: row.id,
    caloriesKcal: row.calories_kcal,
    proteinGrams: row.protein_grams,
    carbohydratesGrams: row.carbohydrates_grams,
    fatGrams: row.fat_grams,
    effectiveFrom: row.effective_from,
    updatedAt: row.updated_at,
  };
}

/**
 * The targets in effect at `at` (default now): the latest row that has already started.
 * Older rows are kept so past days can be judged against the targets of the time.
 */
export async function getCurrentTargets(db: Db, at: Date = new Date()): Promise<NutritionTargets> {
  const row = await db.getFirst<Row>(
    'SELECT * FROM nutrition_targets WHERE effective_from <= ? ORDER BY effective_from DESC, updated_at DESC LIMIT 1',
    [at.toISOString()],
  );
  if (!row) throw new Error('No nutrition targets found; migrations have not run.');
  return toTargets(row);
}

/** The targets for a day: those in effect then, or the first ever set for days before any were (a new install). */
export async function targetsOn(db: Db, at: Date): Promise<NutritionTargets> {
  const row =
    (await db.getFirst<Row>(
      'SELECT * FROM nutrition_targets WHERE effective_from <= ? ORDER BY effective_from DESC, updated_at DESC LIMIT 1',
      [at.toISOString()],
    )) ?? (await db.getFirst<Row>('SELECT * FROM nutrition_targets ORDER BY effective_from, updated_at LIMIT 1'));
  if (!row) throw new Error('No nutrition targets found; migrations have not run.');
  return toTargets(row);
}

export async function setTargets(db: Db, targets: Omit<NutritionTargets, 'id' | 'updatedAt'>): Promise<NutritionTargets> {
  const id = newId();
  await db.run(
    `INSERT INTO nutrition_targets (id, calories_kcal, protein_grams, carbohydrates_grams, fat_grams, effective_from, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      targets.caloriesKcal,
      targets.proteinGrams,
      targets.carbohydratesGrams,
      targets.fatGrams,
      targets.effectiveFrom,
      nowIso(),
    ],
  );
  return getCurrentTargets(db);
}
