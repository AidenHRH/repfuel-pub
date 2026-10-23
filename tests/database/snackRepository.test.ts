import { entriesForDay, logLoggable, quickPicks } from '@/database/repositories/foodLogRepository';
import { getFood, listFoods, setFoodFavourite } from '@/database/repositories/foodRepository';
import { saveFoodAsMeal } from '@/database/repositories/recipeRepository';
import { favouriteItems, isInSnacksRow, quickAdd, setInSnacksRow, snackItems } from '@/database/repositories/snackRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

const at = new Date('2026-10-22T11:30:00Z'); // 12:30 in London: lunchtime by the clock

test('an unnamed quick add is a one-off entry that saves no food', async () => {
  const db = await migratedDb();
  const entry = await quickAdd(db, { name: '  ', kcal: 150, proteinG: null, mealCategory: 'snack', keepAsTile: true, at });
  expect(entry).toMatchObject({ name: 'Quick snack', foodId: null, recipeId: null, mealCategory: 'snack', isApproximate: true });
  expect(entry.nutrients).toEqual({ kcal: 150, proteinG: null, carbsG: null, fatG: null, fibreG: null });
  expect(await entriesForDay(db, '2026-10-22')).toHaveLength(1);
  expect(await listFoods(db, {})).toEqual([]);
  expect(await snackItems(db, at)).toEqual([]);
});

test('a named quick add is remembered and kept as a tile, in the meal picked rather than by the clock', async () => {
  const db = await migratedDb();
  const entry = await quickAdd(db, { name: 'Latte', kcal: 190, proteinG: 10, mealCategory: 'snack', keepAsTile: true, at });
  expect(entry).toMatchObject({ name: 'Latte', mealCategory: 'snack', unit: 'serving', amount: 1 });
  const tiles = await snackItems(db, at);
  expect(tiles.map((t) => t.name)).toEqual(['Latte']);
  expect(tiles[0]).toMatchObject({ kind: 'food', defaultAmount: 1, unit: 'serving', isApproximate: true });
});

test('quick adding the same name again reuses the food and takes the newer numbers', async () => {
  const db = await migratedDb();
  const first = await quickAdd(db, { name: 'Latte', kcal: 190, proteinG: 10, mealCategory: 'snack', keepAsTile: true, at });
  const second = await quickAdd(db, { name: 'latte ', kcal: 210, proteinG: 11, mealCategory: 'breakfast', keepAsTile: true, at });
  expect(second.foodId).toBe(first.foodId);
  expect((await getFood(db, first.foodId!))?.nutrients.kcal).toBe(210);
  // Entries are snapshots: the first one keeps what was logged then.
  const entries = await entriesForDay(db, '2026-10-22');
  expect(entries.map((e) => e.nutrients.kcal)).toEqual([190, 210]);
  expect(await snackItems(db, at)).toHaveLength(1);
});

test('a named quick add can skip the tile row', async () => {
  const db = await migratedDb();
  const entry = await quickAdd(db, { name: 'Office cake', kcal: 300, proteinG: 3, mealCategory: 'snack', keepAsTile: false, at });
  expect(await isInSnacksRow(db, entry.foodId!)).toBe(false);
  expect(await snackItems(db, at)).toEqual([]);
});

test('impossible numbers are refused and nothing is logged', async () => {
  const db = await migratedDb();
  await expect(
    quickAdd(db, { name: 'x', kcal: -5, proteinG: null, mealCategory: 'snack', keepAsTile: false, at }),
  ).rejects.toThrow(RangeError);
  await expect(
    quickAdd(db, { name: 'x', kcal: 100, proteinG: 900, mealCategory: 'snack', keepAsTile: false, at }),
  ).rejects.toThrow(RangeError);
  await expect(
    quickAdd(db, { name: 'x', kcal: Number.NaN, proteinG: null, mealCategory: 'snack', keepAsTile: false, at }),
  ).rejects.toThrow(RangeError);
  expect(await entriesForDay(db, '2026-10-22')).toEqual([]);
});

test('any saved food can join or leave the row, and lives there instead of in My meals', async () => {
  const db = await migratedDb();
  const { foods } = await seedRegulars(db);
  await logLoggable(db, { kind: 'food', id: foods.whey.id }, 1, new Date('2026-10-21T16:00:00Z'));
  expect((await quickPicks(db, at)).map((p) => p.name)).toContain('whey');

  await setInSnacksRow(db, foods.whey.id, true);
  expect((await snackItems(db, at)).map((t) => t.name)).toEqual(['whey']);
  expect((await quickPicks(db, at)).map((p) => p.name)).not.toContain('whey');

  await setInSnacksRow(db, foods.whey.id, false);
  expect(await snackItems(db, at)).toEqual([]);
});

test('tiles you log most come first', async () => {
  const db = await migratedDb();
  await quickAdd(db, { name: 'Banana', kcal: 105, proteinG: 1, mealCategory: 'snack', keepAsTile: true, at });
  const bar = await quickAdd(db, { name: 'Protein bar', kcal: 200, proteinG: 20, mealCategory: 'snack', keepAsTile: true, at });
  await logLoggable(db, { kind: 'food', id: bar.foodId! }, 1, at);
  expect((await snackItems(db, at)).map((t) => t.name)).toEqual(['Protein bar', 'Banana']);
});

test('logging can be filed under a chosen meal', async () => {
  const db = await migratedDb();
  const { foods } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'food', id: foods.whey.id }, 1, at, 'snack');
  expect(entry.mealCategory).toBe('snack');
});

test('a quick add can be part of a whole one; the remembered food stays whole', async () => {
  const db = await migratedDb();
  const half = await quickAdd(db, {
    name: 'Chocolate bar',
    kcal: 240,
    proteinG: 4,
    portions: 0.5,
    mealCategory: 'snack',
    keepAsTile: true,
    at,
  });
  expect(half).toMatchObject({ amount: 0.5, unit: 'serving' });
  expect(half.nutrients.kcal).toBe(120);
  expect((await getFood(db, half.foodId!))?.nutrients.kcal).toBe(240);

  const quarter = await quickAdd(db, {
    name: '',
    kcal: 200,
    proteinG: null,
    portions: 0.25,
    mealCategory: 'snack',
    keepAsTile: false,
    at,
  });
  expect(quarter).toMatchObject({ amount: 0.25 });
  expect(quarter.nutrients.kcal).toBe(50);
  await expect(
    quickAdd(db, { name: '', kcal: 200, proteinG: null, portions: 0, mealCategory: 'snack', keepAsTile: false, at }),
  ).rejects.toThrow(RangeError);
});

test('favourites: starred foods, except ones already a tile or listed as a saved meal', async () => {
  const db = await migratedDb();
  const { foods } = await seedRegulars(db);
  await setFoodFavourite(db, foods.whey.id, true);
  await setFoodFavourite(db, foods.oats.id, true);
  await setFoodFavourite(db, foods.milk.id, true);
  await setInSnacksRow(db, foods.oats.id, true);
  await setFoodFavourite(db, foods.picoMix.id, true);
  await saveFoodAsMeal(db, foods.picoMix.id);
  const tiles = await favouriteItems(db);
  expect(tiles.map((t) => t.name)).toEqual(['milk', 'whey']);
  expect(tiles[1]).toMatchObject({ kind: 'food', id: foods.whey.id, defaultAmount: 1, unit: 'serving' });
});
