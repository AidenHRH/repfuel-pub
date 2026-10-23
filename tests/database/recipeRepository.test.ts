import { logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood, deleteFood, getFood, setFoodFavourite } from '@/database/repositories/foodRepository';
import {
  createRecipe,
  entryMealStatus,
  saveEntryAsMeal,
  saveFoodAsMeal,
  deleteRecipe,
  getRecipe,
  listRecipes,
  recipeNutrients,
  updateRecipe,
} from '@/database/repositories/recipeRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

test('a meal with a share of a batch gets the right per-portion nutrition', async () => {
  const db = await migratedDb();
  const { beefDinner, overnightOats } = await seedRegulars(db);
  expect((await recipeNutrients(db, beefDinner.id)).nutrients.kcal).toBeCloseTo(450.5, 10);
  expect((await recipeNutrients(db, overnightOats.id)).nutrients.proteinG).toBeCloseTo(37.4, 10);
});

test('ingredients round-trip in order, including recipe portions', async () => {
  const db = await migratedDb();
  const { beefDinner, pico } = await seedRegulars(db);
  const loaded = await getRecipe(db, beefDinner.id);
  expect(loaded?.ingredients.map((i) => (i.kind === 'recipe' ? `${i.subRecipeId}:${i.portions}` : `${i.amount}${i.unit}`))).toEqual([
    '250g',
    '150g',
    `${pico.id}:1`,
  ]);
});

test('deleting a food a recipe uses keeps the recipe working', async () => {
  const db = await migratedDb();
  const { beefDinner, foods } = await seedRegulars(db);
  await deleteFood(db, foods.sweetPotato.id);
  expect((await recipeNutrients(db, beefDinner.id)).nutrients.kcal).toBeCloseTo(450.5, 10);
});

test('a recipe that would contain itself is refused and left unchanged', async () => {
  const db = await migratedDb();
  const { pico, beefDinner, foods } = await seedRegulars(db);
  await expect(
    updateRecipe(db, pico.id, {
      name: 'Pico salad',
      portionsMade: 4,
      ingredients: [
        { kind: 'food', foodId: foods.picoMix.id, amount: 1, unit: 'serving' },
        { kind: 'recipe', subRecipeId: beefDinner.id, portions: 1 },
      ],
    }),
  ).rejects.toThrow('Recipe contains itself');
  expect((await getRecipe(db, pico.id))?.ingredients).toHaveLength(1);
});

test('updating a recipe replaces its ingredients', async () => {
  const db = await migratedDb();
  const { pico, foods } = await seedRegulars(db);
  await updateRecipe(db, pico.id, {
    name: 'Pico salad',
    portionsMade: 5,
    ingredients: [{ kind: 'food', foodId: foods.picoMix.id, amount: 2, unit: 'serving' }],
  });
  expect((await recipeNutrients(db, pico.id)).nutrients.kcal).toBeCloseTo(48, 10);
});

test('a recipe must make more than zero portions', async () => {
  const db = await migratedDb();
  await expect(createRecipe(db, { name: 'Bad', portionsMade: 0, ingredients: [] })).rejects.toThrow(RangeError);
});

test('an ingredient pointing at a missing food leaves nothing half-saved', async () => {
  const db = await migratedDb();
  await expect(
    createRecipe(db, { name: 'Ghost', portionsMade: 1, ingredients: [{ kind: 'food', foodId: 'nope', amount: 1, unit: 'g' }] }),
  ).rejects.toThrow();
  expect(await listRecipes(db, {})).toEqual([]);
  expect(await db.getAll('SELECT id FROM recipe_ingredient')).toEqual([]);
});

test('deleted recipes leave the list', async () => {
  const db = await migratedDb();
  const { pico } = await seedRegulars(db);
  await deleteRecipe(db, pico.id);
  expect((await listRecipes(db, {})).map((r) => r.name)).not.toContain('Pico salad');
});

test('changing a food from per serving to per 100 g never breaks the meals that use it', async () => {
  const db = await migratedDb();
  const { overnightOats, foods } = await seedRegulars(db);
  const { updateFood } = jest.requireActual('@/database/repositories/foodRepository');
  const { quickPicks } = jest.requireActual('@/database/repositories/foodLogRepository');
  const { setRecipeFavourite } = jest.requireActual('@/database/repositories/recipeRepository');
  await setRecipeFavourite(db, overnightOats.id, true);
  await updateFood(db, foods.whey.id, { basis: 'per_100g' });

  const { nutrients } = await recipeNutrients(db, overnightOats.id);
  expect(nutrients.kcal).toBeNull();
  expect(nutrients.proteinG).toBeNull();
  const picks = await quickPicks(db);
  expect(picks.map((p: { name: string }) => p.name)).toEqual(['Overnight oats']);
});

const quick = { name: 'Gousto chicken katsu', brand: null, barcode: null, basis: 'per_serving' as const, servingSize: null, servingUnit: null, nutrients: { kcal: 650, proteinG: 42, carbsG: null, fatG: null, fibreG: null }, dataSource: 'user_approximate' as const, notes: null };

test('a quick meal saved as a meal becomes a starred one-portion meal', async () => {
  const db = await migratedDb();
  const food = await createFood(db, quick);
  const meal = await saveFoodAsMeal(db, food.id);
  expect(meal).toMatchObject({ name: 'Gousto chicken katsu', portionsMade: 1, isFavourite: true });
  expect(meal.ingredients).toMatchObject([{ kind: 'food', foodId: food.id, amount: 1, unit: 'serving' }]);
  expect((await recipeNutrients(db, meal.id)).nutrients.kcal).toBe(650);
});

test('saving the same food twice reuses its meal instead of adding a duplicate', async () => {
  const db = await migratedDb();
  const food = await createFood(db, quick);
  const first = await saveFoodAsMeal(db, food.id);
  const second = await saveFoodAsMeal(db, food.id);
  expect(second.id).toBe(first.id);
  expect((await listRecipes(db, {})).filter((r) => r.name === quick.name)).toHaveLength(1);
});

test('a batch recipe made from one food is not mistaken for that food’s meal', async () => {
  const db = await migratedDb();
  const { foods, pico } = await seedRegulars(db);
  const meal = await saveFoodAsMeal(db, foods.whey.id);
  expect(meal.id).not.toBe(pico.id);
  await expect(saveFoodAsMeal(db, foods.oats.id)).rejects.toThrow(/per serving/);
});

test('an entry can be saved as a meal once, whatever it was logged from', async () => {
  const db = await migratedDb();
  const { foods, beefDinner } = await seedRegulars(db);
  const shake = await logLoggable(db, { kind: 'food', id: foods.whey.id }, 1);
  const dinner = await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1);
  const oats = await logLoggable(db, { kind: 'food', id: foods.oats.id }, 50);

  for (const e of [shake, dinner, oats]) expect(await entryMealStatus(db, e)).toBe('can_save');
  for (const e of [shake, dinner, oats]) await saveEntryAsMeal(db, e);
  for (const e of [shake, dinner, oats]) expect(await entryMealStatus(db, e)).toBe('saved');

  expect((await getRecipe(db, beefDinner.id))?.isFavourite).toBe(true);
  expect((await getFood(db, foods.oats.id))?.isFavourite).toBe(true);
  expect((await listRecipes(db, {})).some((r) => r.name === foods.whey.name && r.isFavourite)).toBe(true);
});

test('a starred food already counts as in My meals', async () => {
  const db = await migratedDb();
  const food = await createFood(db, quick);
  await setFoodFavourite(db, food.id, true);
  const entry = await logLoggable(db, { kind: 'food', id: food.id }, 1);
  expect(await entryMealStatus(db, entry)).toBe('saved');
});

test('an entry whose food was deleted cannot be saved as a meal', async () => {
  const db = await migratedDb();
  const food = await createFood(db, quick);
  const entry = await logLoggable(db, { kind: 'food', id: food.id }, 1);
  await deleteFood(db, food.id);
  expect(await entryMealStatus(db, entry)).toBe('unavailable');
});
