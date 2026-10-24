import { photoFor } from '@/data/foodPhotos';
import { localDayKey } from '@/domain/dates';
import { drinkMeasures, isDrink } from '@/domain/drinks';
import { countOf, countPhrase, foodMeasures } from '@/domain/measures';
import { mealCategoryFor } from '@/domain/meals';
import { calculateLogged, sumEntries, type DayTotals } from '@/domain/nutrition';
import type { FoodLogEntry, FoodProduct, Loggable, LogUnit, MealCategory, Nutrients } from '@/domain/types';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

import { getFood } from './foodRepository';
import { foodsShownAsMeals, getRecipe, recipeNutrients } from './recipeRepository';

type Row = {
  id: string;
  food_product_id: string | null;
  recipe_id: string | null;
  food_name_snapshot: string;
  amount: number;
  unit: LogUnit;
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fibre_g: number | null;
  sugar_g?: number | null;
  is_approximate: number;
  logged_at: string;
  local_day: string;
  meal_category: MealCategory;
  notes: string | null;
};

const KEYS = ['kcal', 'proteinG', 'carbsG', 'fatG', 'fibreG', 'sugarG'] as const;

function toEntry(row: Row): FoodLogEntry {
  return {
    id: row.id,
    foodId: row.food_product_id,
    recipeId: row.recipe_id,
    name: row.food_name_snapshot,
    amount: row.amount,
    unit: row.unit,
    nutrients: {
      kcal: row.kcal,
      proteinG: row.protein_g,
      carbsG: row.carbs_g,
      fatG: row.fat_g,
      fibreG: row.fibre_g,
      sugarG: row.sugar_g ?? null,
    },
    isApproximate: row.is_approximate === 1,
    loggedAt: row.logged_at,
    localDay: row.local_day,
    mealCategory: row.meal_category,
    notes: row.notes,
  };
}

function scale(n: Nutrients, factor: number): Nutrients {
  const out = { ...n };
  for (const key of KEYS) out[key] = (n[key] ?? null) === null ? null : n[key]! * factor;
  return out;
}

function foodUnit(food: FoodProduct): LogUnit {
  return food.basis === 'per_serving' ? 'serving' : food.basis === 'per_100g' ? 'g' : 'ml';
}

function foodNutrientsFor(food: FoodProduct, amount: number): Nutrients {
  const unit = foodUnit(food);
  return calculateLogged(
    food.nutrients,
    food.basis,
    unit === 'serving' ? { servings: amount } : { quantity: amount, unit: unit as 'g' | 'ml' },
  );
}

async function insert(db: Db, entry: FoodLogEntry): Promise<void> {
  const n = entry.nutrients;
  const now = nowIso();
  await db.run(
    `INSERT INTO food_log_entry (id, food_product_id, recipe_id, food_name_snapshot, amount, unit, kcal, protein_g, carbs_g, fat_g, fibre_g,
       is_approximate, logged_at, local_day, meal_category, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.foodId,
      entry.recipeId,
      entry.name,
      entry.amount,
      entry.unit,
      n.kcal,
      n.proteinG,
      n.carbsG,
      n.fatG,
      n.fibreG,
      entry.isApproximate ? 1 : 0,
      entry.loggedAt,
      entry.localDay,
      entry.mealCategory,
      entry.notes,
      now,
      now,
    ],
  );
  if (n.sugarG != null) await db.run('UPDATE food_log_entry SET sugar_g = ? WHERE id = ?', [n.sugarG, entry.id]);
}

/**
 * Logs a saved food (amount in servings, or g/ml for per-100 foods) or recipe (amount in portions),
 * storing a snapshot so later edits to the food or recipe never change this entry.
 */
export async function logLoggable(
  db: Db,
  item: { kind: 'food' | 'recipe'; id: string },
  amount: number,
  at: Date = new Date(),
  /** Defaults to the meal for the time of day. */
  mealCategory: MealCategory = mealCategoryFor(at),
): Promise<FoodLogEntry> {
  if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Amount must be more than zero');

  let entry: FoodLogEntry;
  const base = {
    id: newId(),
    amount,
    loggedAt: at.toISOString(),
    localDay: localDayKey(at),
    mealCategory,
    notes: null,
  };

  if (item.kind === 'food') {
    const food = await getFood(db, item.id);
    if (!food) throw new Error('Food not found');
    entry = {
      ...base,
      foodId: food.id,
      recipeId: null,
      name: food.name,
      unit: foodUnit(food),
      nutrients: foodNutrientsFor(food, amount),
      isApproximate: food.dataSource === 'user_approximate',
    };
  } else {
    const recipe = await getRecipe(db, item.id);
    if (!recipe) throw new Error('Recipe not found');
    const perPortion = await recipeNutrients(db, recipe.id);
    entry = {
      ...base,
      foodId: null,
      recipeId: recipe.id,
      name: recipe.name,
      unit: 'portion',
      nutrients: scale(perPortion.nutrients, amount),
      isApproximate: perPortion.isApproximate,
    };
  }

  await insert(db, entry);
  return entry;
}

export async function getEntry(db: Db, id: string): Promise<FoodLogEntry | null> {
  const row = await db.getFirst<Row>('SELECT * FROM food_log_entry WHERE id = ?', [id]);
  return row ? toEntry(row) : null;
}

/** Changing the amount scales the entry's own snapshot; the source food is never re-read. */
export async function updateEntry(
  db: Db,
  id: string,
  patch: { amount?: number; mealCategory?: MealCategory; loggedAt?: Date },
): Promise<FoodLogEntry> {
  const current = await getEntry(db, id);
  if (!current) throw new Error('Entry not found');
  if (patch.amount !== undefined && (!Number.isFinite(patch.amount) || patch.amount <= 0)) {
    throw new RangeError('Amount must be more than zero');
  }
  const amount = patch.amount ?? current.amount;
  const n = scale(current.nutrients, amount / current.amount);
  const loggedAt = patch.loggedAt ? patch.loggedAt.toISOString() : current.loggedAt;
  const localDay = patch.loggedAt ? localDayKey(patch.loggedAt) : current.localDay;
  await db.run(
    `UPDATE food_log_entry SET amount = ?, kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ?, fibre_g = ?, logged_at = ?, local_day = ?,
       meal_category = ?, updated_at = ? WHERE id = ?`,
    [
      amount,
      n.kcal,
      n.proteinG,
      n.carbsG,
      n.fatG,
      n.fibreG,
      loggedAt,
      localDay,
      patch.mealCategory ?? current.mealCategory,
      nowIso(),
      id,
    ],
  );
  await db.run('UPDATE food_log_entry SET sugar_g = ? WHERE id = ?', [n.sugarG ?? null, id]);
  return (await getEntry(db, id))!;
}

export async function deleteEntry(db: Db, id: string): Promise<void> {
  await db.run('DELETE FROM food_log_entry WHERE id = ?', [id]);
}

/** Puts back an entry exactly as it was (Undo after delete). */
export async function restoreEntry(db: Db, entry: FoodLogEntry): Promise<void> {
  await insert(db, entry);
}

type PhotoRow = Row & {
  food_image: string | null;
  food_preset: string | null;
  recipe_photo: string | null;
  food_basis: FoodProduct['basis'] | null;
  food_serving: number | null;
  food_pack: number | null;
  food_piece_g: number | null;
  food_piece_label: string | null;
};

/** "2 biscuits" when a g/ml amount is a count of one of the food's sizes. */
function countFor(row: PhotoRow): string | undefined {
  if (!row.food_basis || row.food_basis === 'per_serving' || (row.unit !== 'g' && row.unit !== 'ml')) return undefined;
  const measures = foodMeasures({
    basis: row.food_basis,
    servingSize: row.food_serving,
    presetId: row.food_preset,
    packSize: row.food_pack,
    pieceG: row.food_piece_g,
    pieceLabel: row.food_piece_label,
  });
  for (const m of measures) {
    const n = countOf(row.amount, m);
    if (n !== null) return countPhrase(n, m, row.food_name_snapshot);
  }
  return undefined;
}

/** A day's entries in time order, each with its photo when there is one (the owner's, the pack's or a built-in's). */
export async function entriesForDay(db: Db, localDay: string): Promise<FoodLogEntry[]> {
  const rows = await db.getAll<PhotoRow>(
    `SELECT e.*, f.image_url AS food_image, f.preset_id AS food_preset, p.file_uri AS recipe_photo,
            f.basis AS food_basis, f.serving_size AS food_serving, f.pack_size AS food_pack,
            f.piece_g AS food_piece_g, f.piece_label AS food_piece_label
     FROM food_log_entry e
     LEFT JOIN food_product f ON f.id = e.food_product_id
     LEFT JOIN recipe_photo p ON p.recipe_ref = 'recipe:' || e.recipe_id
     WHERE e.local_day = ? ORDER BY e.logged_at, e.created_at`,
    [localDay],
  );
  return rows.map((row) => {
    const photo = row.recipe_photo ?? photoFor({ imageUrl: row.food_image, presetId: row.food_preset });
    const count = countFor(row);
    return { ...toEntry(row), ...(photo ? { photo } : {}), ...(count ? { count } : {}) };
  });
}

export async function dayTotals(db: Db, localDay: string): Promise<DayTotals> {
  const entries = await entriesForDay(db, localDay);
  return sumEntries(entries.map((e) => ({ ...e.nutrients, isApproximate: e.isApproximate })));
}

const QUICK_PICK_WINDOW_DAYS = 14;

/** What the owner logs in one tap: favourites first, then most-logged over the last 14 days. */
export async function quickPicks(db: Db, now: Date = new Date(), limit = 8): Promise<Loggable[]> {
  const since = new Date(now.getTime() - QUICK_PICK_WINDOW_DAYS * 86_400_000).toISOString();

  const favourites = await db.getAll<{ kind: 'food' | 'recipe'; id: string }>(
    `SELECT 'food' AS kind, id FROM food_product WHERE is_favourite = 1 AND deleted_at IS NULL AND in_snacks_row = 0
     UNION ALL
     SELECT 'recipe' AS kind, id FROM recipe WHERE is_favourite = 1 AND deleted_at IS NULL`,
  );
  const frequentRows = await db.getAll<{ item_kind: 'food' | 'recipe'; item_id: string }>(
    `SELECT CASE WHEN e.recipe_id IS NOT NULL THEN 'recipe' ELSE 'food' END AS item_kind,
            coalesce(e.recipe_id, e.food_product_id) AS item_id
     FROM food_log_entry e
     LEFT JOIN food_product f ON f.id = e.food_product_id
     LEFT JOIN recipe r ON r.id = e.recipe_id
     WHERE e.logged_at >= ? AND coalesce(e.recipe_id, e.food_product_id) IS NOT NULL
       AND f.deleted_at IS NULL AND r.deleted_at IS NULL AND coalesce(f.in_snacks_row, 0) = 0
     GROUP BY item_kind, item_id
     ORDER BY count(*) DESC, max(e.logged_at) DESC`,
    [since],
  );
  // A food saved as its own one-portion meal shows once, as that meal.
  const shownAsMeal = await foodsShownAsMeals(db, { starredOnly: true });
  const frequent = frequentRows
    .map((r) => ({ kind: r.item_kind, id: r.item_id }))
    .filter((f) => !(f.kind === 'food' && shownAsMeal.has(f.id)));

  const freqRank = new Map(frequent.map((f, i) => [`${f.kind}:${f.id}`, i]));
  favourites.sort((a, b) => (freqRank.get(`${a.kind}:${a.id}`) ?? 1e9) - (freqRank.get(`${b.kind}:${b.id}`) ?? 1e9));

  const seen = new Set<string>();
  const picks: Loggable[] = [];
  for (const item of [...favourites, ...frequent]) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key) || picks.length >= limit) continue;
    seen.add(key);
    const pick = await toLoggable(db, item);
    if (pick) picks.push(pick);
  }
  return picks;
}

const RECENT_DAYS = 30;

/** What was logged in the last 30 days, newest first, once each, at the amount last logged. */
/** Recently had foods and meals, newest first; with `meal`, what was had at that meal comes first. */
export async function recentItems(db: Db, now: Date = new Date(), limit = 12, meal?: MealCategory): Promise<Loggable[]> {
  const since = new Date(now.getTime() - RECENT_DAYS * 86_400_000).toISOString();
  const rows = await db.getAll<{ item_kind: 'food' | 'recipe'; item_id: string }>(
    `SELECT CASE WHEN e.recipe_id IS NOT NULL THEN 'recipe' ELSE 'food' END AS item_kind,
            coalesce(e.recipe_id, e.food_product_id) AS item_id
     FROM food_log_entry e
     LEFT JOIN food_product f ON f.id = e.food_product_id
     LEFT JOIN recipe r ON r.id = e.recipe_id
     WHERE e.logged_at >= ? AND coalesce(e.recipe_id, e.food_product_id) IS NOT NULL
       AND f.deleted_at IS NULL AND r.deleted_at IS NULL
     GROUP BY item_kind, item_id
     ORDER BY max(e.meal_category = ?) DESC, max(e.logged_at) DESC
     LIMIT ?`,
    [since, meal ?? '', limit],
  );
  const items = await Promise.all(rows.map((r) => toLoggable(db, { kind: r.item_kind, id: r.item_id })));
  return items.filter((i): i is Loggable => i !== null);
}

/** A saved food or recipe as a one-tap item, or null if it has no sensible default amount. */
export async function toLoggable(db: Db, item: { kind: 'food' | 'recipe'; id: string }): Promise<Loggable | null> {
  if (item.kind === 'recipe') {
    const recipe = await getRecipe(db, item.id);
    if (!recipe || recipe.deletedAt) return null;
    const { nutrients, isApproximate } = await recipeNutrients(db, recipe.id);
    return {
      kind: 'recipe',
      id: recipe.id,
      name: recipe.name,
      defaultAmount: 1,
      unit: 'portion',
      nutrients,
      isApproximate,
      isFavourite: recipe.isFavourite,
    };
  }

  const food = await getFood(db, item.id);
  if (!food || food.deletedAt) return null;
  let defaultAmount: number | null = 1;
  if (food.basis !== 'per_serving') {
    const last = await db.getFirst<{ amount: number }>(
      'SELECT amount FROM food_log_entry WHERE food_product_id = ? ORDER BY logged_at DESC LIMIT 1',
      [food.id],
    );
    // A drink with no size of its own starts at its first drink size (a can).
    defaultAmount = last?.amount ?? food.servingSize ?? (isDrink(food) ? drinkMeasures(food)[0].grams : null);
  }
  if (!defaultAmount) return null;
  return {
    kind: 'food',
    id: food.id,
    name: food.name,
    defaultAmount,
    unit: foodUnit(food),
    nutrients: foodNutrientsFor(food, defaultAmount),
    isApproximate: food.dataSource === 'user_approximate',
    isFavourite: food.isFavourite,
  };
}

/** When each food ("food:<id>") and meal ("recipe:<id>") was last logged, for "You had this Tuesday". */
export async function lastHad(db: Db): Promise<Map<string, string>> {
  const rows = await db.getAll<{ key: string; at: string }>(
    `SELECT CASE WHEN recipe_id IS NOT NULL THEN 'recipe:' || recipe_id ELSE 'food:' || food_product_id END AS key,
            max(logged_at) AS at
     FROM food_log_entry WHERE coalesce(recipe_id, food_product_id) IS NOT NULL GROUP BY key`,
  );
  return new Map(rows.map((r) => [r.key, r.at]));
}
