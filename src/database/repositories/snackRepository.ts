import { localDayKey } from '@/domain/dates';
import { MEAL_LABELS } from '@/domain/meals';
import type { FoodLogEntry, Loggable, MealCategory, Nutrients } from '@/domain/types';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

import { logLoggable, restoreEntry, toLoggable } from './foodLogRepository';
import { createFood, getFood, updateFood } from './foodRepository';
import { foodsShownAsMeals } from './recipeRepository';

export type QuickAddInput = {
  /** Blank = a one-off entry that saves no food. */
  name: string;
  kcal: number;
  proteinG: number | null;
  /** How much of one was had, e.g. 0.5 for half a bar. `kcal` and `proteinG` are for a whole one. Default 1. */
  portions?: number;
  mealCategory: MealCategory;
  /** Named items only: show it as a tile in Snacks (or Drinks, for a drink). */
  keepAsTile: boolean;
  at?: Date;
};

function validate({ kcal, proteinG, portions = 1 }: QuickAddInput) {
  if (!Number.isFinite(portions) || portions <= 0 || portions > 10) throw new RangeError('Portion must be more than zero');
  if (!Number.isFinite(kcal) || kcal < 0 || kcal > 5000) throw new RangeError('Calories must be between 0 and 5,000');
  if (proteinG !== null && (!Number.isFinite(proteinG) || proteinG < 0 || proteinG > 500)) {
    throw new RangeError('Protein must be between 0 and 500 g');
  }
}

/**
 * Logs a snack or drink from just its calories (and protein, if known). A named one is remembered as a
 * per-serving estimate — the same name again reuses it, taking the newer numbers — and can be kept as a tile.
 */
export async function quickAdd(db: Db, input: QuickAddInput): Promise<FoodLogEntry> {
  validate(input);
  const at = input.at ?? new Date();
  const name = input.name.trim();
  const portions = input.portions ?? 1;
  const nutrients: Nutrients = { kcal: input.kcal, proteinG: input.proteinG, carbsG: null, fatG: null, fibreG: null };

  if (!name) {
    const entry: FoodLogEntry = {
      id: newId(),
      foodId: null,
      recipeId: null,
      name: `Quick ${MEAL_LABELS[input.mealCategory].toLowerCase()}`,
      amount: portions,
      unit: 'serving',
      nutrients: {
        ...nutrients,
        kcal: input.kcal * portions,
        proteinG: input.proteinG === null ? null : input.proteinG * portions,
      },
      isApproximate: true,
      loggedAt: at.toISOString(),
      localDay: localDayKey(at),
      mealCategory: input.mealCategory,
      notes: null,
    };
    await restoreEntry(db, entry);
    return entry;
  }

  const existing = await db.getFirst<{ id: string }>(
    `SELECT id FROM food_product
     WHERE deleted_at IS NULL AND basis = 'per_serving' AND data_source = 'user_approximate' AND lower(trim(name)) = ?
     ORDER BY in_snacks_row DESC, updated_at DESC LIMIT 1`,
    [name.toLowerCase()],
  );
  let foodId: string;
  if (existing) {
    foodId = existing.id;
    const food = await getFood(db, foodId);
    if (food && (food.nutrients.kcal !== nutrients.kcal || food.nutrients.proteinG !== nutrients.proteinG)) {
      await updateFood(db, foodId, { nutrients });
    }
  } else {
    const food = await createFood(db, {
      name,
      brand: null,
      barcode: null,
      basis: 'per_serving',
      servingSize: null,
      servingUnit: null,
      nutrients,
      dataSource: 'user_approximate',
      notes: null,
    });
    foodId = food.id;
  }
  if (input.keepAsTile) {
    if (input.mealCategory === 'drink') await setInDrinksRow(db, foodId, true);
    else await setInSnacksRow(db, foodId, true);
  }
  return logLoggable(db, { kind: 'food', id: foodId }, portions, at, input.mealCategory);
}

export async function setInSnacksRow(db: Db, foodId: string, on: boolean): Promise<void> {
  await db.run('UPDATE food_product SET in_snacks_row = ?, updated_at = ? WHERE id = ?', [on ? 1 : 0, nowIso(), foodId]);
}

export async function isInSnacksRow(db: Db, foodId: string): Promise<boolean> {
  const row = await db.getFirst<{ in_snacks_row: number }>('SELECT in_snacks_row FROM food_product WHERE id = ?', [foodId]);
  return row?.in_snacks_row === 1;
}

export async function setInDrinksRow(db: Db, foodId: string, on: boolean): Promise<void> {
  await db.run('UPDATE food_product SET in_drinks_row = ?, updated_at = ? WHERE id = ?', [on ? 1 : 0, nowIso(), foodId]);
}

export async function isInDrinksRow(db: Db, foodId: string): Promise<boolean> {
  const row = await db.getFirst<{ in_drinks_row: number }>('SELECT in_drinks_row FROM food_product WHERE id = ?', [foodId]);
  return row?.in_drinks_row === 1;
}

const RECENT_DAYS = 30;

/** The Snacks tiles: most logged in the last 30 days first, then by name. */
export async function snackItems(db: Db, now: Date = new Date()): Promise<Loggable[]> {
  return tileItems(db, 'in_snacks_row', now);
}

/** The Drinks tiles, ordered the same way. */
export async function drinkItems(db: Db, now: Date = new Date()): Promise<Loggable[]> {
  return tileItems(db, 'in_drinks_row', now);
}

async function tileItems(db: Db, row: 'in_snacks_row' | 'in_drinks_row', now: Date): Promise<Loggable[]> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString();
  const rows = await db.getAll<{ id: string }>(
    `SELECT f.id FROM food_product f
     LEFT JOIN food_log_entry e ON e.food_product_id = f.id AND e.logged_at >= ?
     WHERE f.${row} = 1 AND f.deleted_at IS NULL
     GROUP BY f.id
     ORDER BY count(e.id) DESC, f.name COLLATE NOCASE`,
    [since],
  );
  const items = await Promise.all(rows.map((r) => toLoggable(db, { kind: 'food', id: r.id })));
  return items.filter((i): i is Loggable => i !== null);
}

/** Favourites on Log food: starred foods by name, leaving out tiles and quick meals already listed as saved meals. */
export async function favouriteItems(db: Db): Promise<Loggable[]> {
  const [rows, asMeals] = await Promise.all([
    db.getAll<{ id: string }>(
      `SELECT id FROM food_product
       WHERE is_favourite = 1 AND in_snacks_row = 0 AND in_drinks_row = 0 AND deleted_at IS NULL
       ORDER BY name COLLATE NOCASE`,
    ),
    foodsShownAsMeals(db),
  ]);
  const items = await Promise.all(rows.filter((r) => !asMeals.has(r.id)).map((r) => toLoggable(db, { kind: 'food', id: r.id })));
  return items.filter((i): i is Loggable => i !== null);
}
