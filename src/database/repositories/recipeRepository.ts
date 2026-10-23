import { findCycle, recipePortionNutrients, type RecipeLookup } from '@/domain/recipes';
import type { FoodLogEntry, FoodProduct, Nutrients, Recipe, RecipeIngredient } from '@/domain/types';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

import { getFood, setFoodFavourite } from './foodRepository';

type RecipeRow = {
  id: string;
  name: string;
  portions_made: number;
  notes: string | null;
  is_favourite: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

type IngredientRow = {
  id: string;
  recipe_id: string;
  food_product_id: string | null;
  sub_recipe_id: string | null;
  amount: number;
  unit: 'g' | 'ml' | 'serving' | 'portion';
  sort_order: number;
};

export type NewIngredient =
  | { kind: 'food'; foodId: string; amount: number; unit: 'g' | 'ml' | 'serving' }
  | { kind: 'recipe'; subRecipeId: string; portions: number };

export type RecipeInput = {
  name: string;
  portionsMade: number;
  notes?: string | null;
  ingredients: NewIngredient[];
  /** Only used on create: a new meal is starred so it shows up for one-tap logging. */
  isFavourite?: boolean;
};

function toIngredient(row: IngredientRow): RecipeIngredient {
  const base = { id: row.id, recipeId: row.recipe_id, sortOrder: row.sort_order };
  if (row.sub_recipe_id) return { ...base, kind: 'recipe', subRecipeId: row.sub_recipe_id, portions: row.amount };
  return { ...base, kind: 'food', foodId: row.food_product_id!, amount: row.amount, unit: row.unit as 'g' | 'ml' | 'serving' };
}

/** Reads a recipe even if deleted, so meals that use it and history keep resolving. */
export async function getRecipe(db: Db, id: string): Promise<Recipe | null> {
  const row = await db.getFirst<RecipeRow>('SELECT * FROM recipe WHERE id = ?', [id]);
  if (!row) return null;
  const ingredients = await db.getAll<IngredientRow>('SELECT * FROM recipe_ingredient WHERE recipe_id = ? ORDER BY sort_order', [
    id,
  ]);
  return {
    id: row.id,
    name: row.name,
    portionsMade: row.portions_made,
    notes: row.notes,
    isFavourite: row.is_favourite === 1,
    deletedAt: row.deleted_at,
    ingredients: ingredients.map(toIngredient),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Loads recipes and everything they reach (foods and batch recipes, deleted ones included). */
export async function loadRecipeMaps(
  db: Db,
  rootIds: string[],
): Promise<{ recipes: Map<string, Recipe>; foods: Map<string, FoodProduct> }> {
  const recipes = new Map<string, Recipe>();
  const foods = new Map<string, FoodProduct>();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.pop()!;
    if (recipes.has(id)) continue;
    const recipe = await getRecipe(db, id);
    if (!recipe) continue;
    recipes.set(id, recipe);
    for (const ing of recipe.ingredients) {
      if (ing.kind === 'recipe') queue.push(ing.subRecipeId);
      else if (!foods.has(ing.foodId)) {
        const food = await getFood(db, ing.foodId);
        if (food) foods.set(food.id, food);
      }
    }
  }
  return { recipes, foods };
}

/** A synchronous lookup over a recipe and everything it reaches. */
export async function loadRecipeTree(db: Db, rootIds: string[]): Promise<RecipeLookup> {
  const { recipes, foods } = await loadRecipeMaps(db, rootIds);
  return { recipe: (id) => recipes.get(id), food: (id) => foods.get(id) };
}

/** Nutrients for one portion of the recipe. */
export async function recipeNutrients(db: Db, id: string): Promise<{ nutrients: Nutrients; isApproximate: boolean }> {
  return recipePortionNutrients(id, await loadRecipeTree(db, [id]));
}

function validate(input: RecipeInput) {
  if (!input.name.trim()) throw new RangeError('A recipe needs a name');
  if (!Number.isFinite(input.portionsMade) || input.portionsMade <= 0) {
    throw new RangeError('A recipe must make more than zero portions');
  }
  for (const ing of input.ingredients) {
    const amount = ing.kind === 'recipe' ? ing.portions : ing.amount;
    if (!Number.isFinite(amount) || amount <= 0) throw new RangeError('Ingredient amounts must be more than zero');
  }
}

async function writeIngredients(db: Db, recipeId: string, ingredients: NewIngredient[]) {
  await db.run('DELETE FROM recipe_ingredient WHERE recipe_id = ?', [recipeId]);
  for (const [i, ing] of ingredients.entries()) {
    if (ing.kind === 'food') {
      await db.run(
        'INSERT INTO recipe_ingredient (id, recipe_id, food_product_id, sub_recipe_id, amount, unit, sort_order) VALUES (?, ?, ?, NULL, ?, ?, ?)',
        [newId(), recipeId, ing.foodId, ing.amount, ing.unit, i],
      );
    } else {
      await db.run(
        "INSERT INTO recipe_ingredient (id, recipe_id, food_product_id, sub_recipe_id, amount, unit, sort_order) VALUES (?, ?, NULL, ?, ?, 'portion', ?)",
        [newId(), recipeId, ing.subRecipeId, ing.portions, i],
      );
    }
  }
}

async function assertNoCycle(db: Db, recipeId: string, ingredients: NewIngredient[]) {
  const subIds = ingredients.flatMap((ing) => (ing.kind === 'recipe' ? [ing.subRecipeId] : []));
  if (findCycle(recipeId, subIds, await loadRecipeTree(db, subIds))) throw new Error('Recipe contains itself');
}

export async function createRecipe(db: Db, input: RecipeInput): Promise<Recipe> {
  validate(input);
  const id = newId();
  const now = nowIso();
  await db.transaction(async () => {
    await db.run(
      'INSERT INTO recipe (id, name, portions_made, notes, is_favourite, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, input.name.trim(), input.portionsMade, input.notes ?? null, input.isFavourite ? 1 : 0, now, now],
    );
    await writeIngredients(db, id, input.ingredients);
  });
  return (await getRecipe(db, id))!;
}

export async function updateRecipe(db: Db, id: string, input: RecipeInput): Promise<Recipe> {
  validate(input);
  await assertNoCycle(db, id, input.ingredients);
  await db.transaction(async () => {
    await db.run('UPDATE recipe SET name = ?, portions_made = ?, notes = ?, updated_at = ? WHERE id = ?', [
      input.name.trim(),
      input.portionsMade,
      input.notes ?? null,
      nowIso(),
      id,
    ]);
    await writeIngredients(db, id, input.ingredients);
  });
  return (await getRecipe(db, id))!;
}

/** Soft delete: leaves lists, but meals that include it and past entries keep working. */
export async function deleteRecipe(db: Db, id: string): Promise<void> {
  await db.run('UPDATE recipe SET deleted_at = ?, is_favourite = 0 WHERE id = ?', [nowIso(), id]);
}

export async function setRecipeFavourite(db: Db, id: string, favourite: boolean): Promise<void> {
  await db.run('UPDATE recipe SET is_favourite = ?, updated_at = ? WHERE id = ?', [favourite ? 1 : 0, nowIso(), id]);
}

export async function listRecipes(db: Db, { search }: { search?: string }): Promise<Recipe[]> {
  const term = search?.trim().toLowerCase() ?? '';
  const rows = await db.getAll<{ id: string }>(
    `SELECT id FROM recipe WHERE deleted_at IS NULL AND instr(lower(name), ?) > 0 ORDER BY is_favourite DESC, name COLLATE NOCASE`,
    [term],
  );
  const recipes = await Promise.all(rows.map((r) => getRecipe(db, r.id)));
  return recipes.filter((r): r is Recipe => r !== null);
}

/**
 * Rows (r = recipe, i = its only ingredient) for meals that are exactly one serving of one food, as made by
 * `saveFoodAsMeal`.
 */
const FOOD_MEAL_SQL = `recipe r JOIN recipe_ingredient i ON i.recipe_id = r.id
  WHERE r.deleted_at IS NULL AND r.portions_made = 1 AND i.food_product_id IS NOT NULL AND i.amount = 1 AND i.unit = 'serving'
    AND (SELECT count(*) FROM recipe_ingredient WHERE recipe_id = r.id) = 1`;

/** Foods that have their own one-portion meal, so lists can show just the meal. */
export async function foodsShownAsMeals(db: Db, { starredOnly = false } = {}): Promise<Set<string>> {
  const rows = await db.getAll<{ food_id: string }>(
    `SELECT i.food_product_id AS food_id FROM ${FOOD_MEAL_SQL}${starredOnly ? ' AND r.is_favourite = 1' : ''}`,
  );
  return new Set(rows.map((r) => r.food_id));
}

async function findFoodMeal(db: Db, foodId: string): Promise<Recipe | null> {
  const row = await db.getFirst<{ id: string }>(
    `SELECT r.id FROM ${FOOD_MEAL_SQL} AND i.food_product_id = ? ORDER BY r.is_favourite DESC, r.created_at LIMIT 1`,
    [foodId],
  );
  return row ? getRecipe(db, row.id) : null;
}

/**
 * Puts a per-serving food (e.g. a quick meal) in My meals as a starred one-portion meal. Saving the same
 * food again reuses (and re-stars) its meal rather than adding a duplicate.
 */
export async function saveFoodAsMeal(db: Db, foodId: string): Promise<Recipe> {
  const food = await getFood(db, foodId);
  if (!food || food.deletedAt) throw new Error('Food not found');
  if (food.basis !== 'per_serving') throw new RangeError('Only foods counted per serving can become a meal');
  const existing = await findFoodMeal(db, foodId);
  if (existing) {
    if (!existing.isFavourite) await setRecipeFavourite(db, existing.id, true);
    return (await getRecipe(db, existing.id))!;
  }
  return createRecipe(db, {
    name: food.name,
    portionsMade: 1,
    ingredients: [{ kind: 'food', foodId, amount: 1, unit: 'serving' }],
    isFavourite: true,
  });
}

export type EntryMealStatus = 'can_save' | 'saved' | 'unavailable';

/** Whether the thing an entry was logged from is already in My meals. */
export async function entryMealStatus(db: Db, entry: Pick<FoodLogEntry, 'foodId' | 'recipeId'>): Promise<EntryMealStatus> {
  if (entry.recipeId) {
    const recipe = await getRecipe(db, entry.recipeId);
    if (!recipe || recipe.deletedAt) return 'unavailable';
    return recipe.isFavourite ? 'saved' : 'can_save';
  }
  if (!entry.foodId) return 'unavailable';
  const food = await getFood(db, entry.foodId);
  if (!food || food.deletedAt) return 'unavailable';
  // A starred food is already in My meals.
  if (food.isFavourite || food.basis !== 'per_serving') return food.isFavourite ? 'saved' : 'can_save';
  return (await findFoodMeal(db, food.id))?.isFavourite ? 'saved' : 'can_save';
}

/** Adds what an entry was logged from to My meals: stars a meal, or a per-100 food; makes a meal from a per-serving food. */
export async function saveEntryAsMeal(db: Db, entry: Pick<FoodLogEntry, 'foodId' | 'recipeId'>): Promise<void> {
  if (entry.recipeId) return setRecipeFavourite(db, entry.recipeId, true);
  if (!entry.foodId) throw new Error('Nothing to save');
  const food = await getFood(db, entry.foodId);
  if (!food || food.deletedAt) throw new Error('Food not found');
  if (food.basis !== 'per_serving') return setFoodFavourite(db, food.id, true);
  await saveFoodAsMeal(db, food.id);
}

/** True when a meal (not deleted) already has this name, ignoring case and surrounding spaces. */
export async function recipeNameTaken(db: Db, name: string): Promise<boolean> {
  const row = await db.getFirst<{ id: string }>(
    'SELECT id FROM recipe WHERE deleted_at IS NULL AND lower(trim(name)) = ? LIMIT 1',
    [name.trim().toLowerCase()],
  );
  return row !== null;
}
