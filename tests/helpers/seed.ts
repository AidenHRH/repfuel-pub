import type { Db } from '@/database/Db';
import { runMigrations } from '@/database/migrate';
import { createFood } from '@/database/repositories/foodRepository';
import { createRecipe } from '@/database/repositories/recipeRepository';
import { setSetting } from '@/database/repositories/settingsRepository';
import type { FoodProduct } from '@/domain/types';

import { beef, milk, oats, picoMix, sweetPotato, whey } from './foods';
import { createTestDb } from './testDb';

/**
 * A migrated database for a phone that has been set up and has seen the tour, with tips off (welcome, tour and tip
 * tests turn them back on).
 */
export async function migratedDb() {
  const db = createTestDb();
  await runMigrations(db);
  await setSetting(db, 'setup', { done: true });
  await setSetting(db, 'tour', { doneAt: '2026-01-01T00:00:00.000Z', tipsOn: false, shown: [], lastTipAt: null });
  return db;
}

function strip(f: FoodProduct) {
  const { id: _id, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = f;
  return rest;
}

/** Seeds a typical set of regular meals with realistic label values; returns their ids. */
export async function seedRegulars(db: Db) {
  const [o, m, w, pm, sp, b] = await Promise.all(
    [oats, milk, whey, picoMix, sweetPotato, beef].map((f) => createFood(db, { ...strip(f), name: f.name })),
  );
  const overnightOats = await createRecipe(db, {
    name: 'Overnight oats',
    portionsMade: 1,
    ingredients: [
      { kind: 'food', foodId: o.id, amount: 50, unit: 'g' },
      { kind: 'food', foodId: m.id, amount: 200, unit: 'ml' },
      { kind: 'food', foodId: w.id, amount: 1, unit: 'serving' },
    ],
  });
  const pico = await createRecipe(db, {
    name: 'Pico salad',
    portionsMade: 4,
    ingredients: [{ kind: 'food', foodId: pm.id, amount: 1, unit: 'serving' }],
  });
  const beefDinner = await createRecipe(db, {
    name: 'Beef & sweet potato',
    portionsMade: 1,
    ingredients: [
      { kind: 'food', foodId: sp.id, amount: 250, unit: 'g' },
      { kind: 'food', foodId: b.id, amount: 150, unit: 'g' },
      { kind: 'recipe', subRecipeId: pico.id, portions: 1 },
    ],
  });
  return { foods: { oats: o, milk: m, whey: w, picoMix: pm, sweetPotato: sp, beef: b }, overnightOats, pico, beefDinner };
}
