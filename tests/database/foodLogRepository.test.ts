import { createFood, deleteFood, setFoodFavourite } from '@/database/repositories/foodRepository';
import {
  dayTotals,
  deleteEntry,
  entriesForDay,
  logLoggable,
  quickPicks,
  restoreEntry,
  updateEntry,
} from '@/database/repositories/foodLogRepository';
import { saveFoodAsMeal, updateRecipe } from '@/database/repositories/recipeRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

const at = (iso: string) => new Date(iso);

test('logging a meal snapshots its nutrition, day and meal time', async () => {
  const db = await migratedDb();
  const { beefDinner } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at('2026-10-21T18:30:00Z'));
  expect(entry).toMatchObject({
    name: 'Beef & sweet potato',
    unit: 'portion',
    amount: 1,
    mealCategory: 'dinner',
    localDay: '2026-10-21',
  });
  expect(entry.nutrients.kcal).toBeCloseTo(450.5, 10);
});

test('editing the pico recipe later does not change a dinner already logged', async () => {
  const db = await migratedDb();
  const { beefDinner, pico, foods } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at('2026-10-21T18:30:00Z'));
  await updateRecipe(db, pico.id, {
    name: 'Pico salad',
    portionsMade: 1,
    ingredients: [{ kind: 'food', foodId: foods.picoMix.id, amount: 1, unit: 'serving' }],
  });
  const [stored] = await entriesForDay(db, '2026-10-21');
  expect(stored.id).toBe(entry.id);
  expect(stored.nutrients.kcal).toBeCloseTo(450.5, 10);
});

test('changing the amount scales the entry’s own snapshot', async () => {
  const db = await migratedDb();
  const { beefDinner } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at('2026-10-21T18:30:00Z'));
  const half = await updateEntry(db, entry.id, { amount: 0.5 });
  expect(half.nutrients.kcal).toBeCloseTo(225.25, 10);
  expect(half.nutrients.proteinG).toBeCloseTo(18.55, 10);
});

test('moving an entry to another time updates its day', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-21T07:30:00Z'));
  const moved = await updateEntry(db, entry.id, { loggedAt: at('2026-10-20T07:30:00Z'), mealCategory: 'snack' });
  expect(moved).toMatchObject({ localDay: '2026-10-20', mealCategory: 'snack' });
});

test('a per-serving food logs in servings and per-100 foods in grams', async () => {
  const db = await migratedDb();
  const { foods } = await seedRegulars(db);
  const shake = await logLoggable(db, { kind: 'food', id: foods.whey.id }, 2, at('2026-10-21T10:00:00Z'));
  expect(shake).toMatchObject({ unit: 'serving', amount: 2 });
  expect(shake.nutrients.proteinG).toBeCloseTo(48, 10);
  const potato = await logLoggable(db, { kind: 'food', id: foods.sweetPotato.id }, 200, at('2026-10-21T13:00:00Z'));
  expect(potato).toMatchObject({ unit: 'g', amount: 200 });
  expect(potato.nutrients.kcal).toBeCloseTo(172, 10);
});

test('deleting a food keeps entries that used it', async () => {
  const db = await migratedDb();
  const { foods } = await seedRegulars(db);
  await logLoggable(db, { kind: 'food', id: foods.whey.id }, 1, at('2026-10-21T10:00:00Z'));
  await deleteFood(db, foods.whey.id);
  expect(await entriesForDay(db, '2026-10-21')).toHaveLength(1);
});

test('day totals add entries at full precision with approximate and incomplete flags', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  const katsu = await createFood(db, {
    name: 'Gousto katsu',
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 650, proteinG: 40, carbsG: null, fatG: null, fibreG: null },
    dataSource: 'user_approximate',
    notes: null,
  });
  await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-21T07:30:00Z'));
  await logLoggable(db, { kind: 'food', id: katsu.id }, 1, at('2026-10-21T18:30:00Z'));
  const day = await dayTotals(db, '2026-10-21');
  expect(day.totals.kcal).toBeCloseTo(1053.5, 10);
  expect(day.approximate).toBe(true);
  expect(day.incomplete.carbsG).toBe(true);
  expect(day.incomplete.kcal).toBe(false);
});

test('late on the autumn clock-change day still counts for that day', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-25T23:30:00Z'));
  expect(entry.localDay).toBe('2026-10-25');
});

test('undoing a delete restores the identical entry', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  const entry = await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-21T07:30:00Z'));
  await deleteEntry(db, entry.id);
  expect(await entriesForDay(db, '2026-10-21')).toEqual([]);
  await restoreEntry(db, entry);
  expect(await entriesForDay(db, '2026-10-21')).toEqual([entry]);
});

describe('quickPicks', () => {
  const now = at('2026-10-21T12:00:00Z');

  test('favourites first, then what you log most in the last 14 days', async () => {
    const db = await migratedDb();
    const { overnightOats, beefDinner, foods } = await seedRegulars(db);
    for (let i = 0; i < 3; i++)
      await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at(`2026-10-1${5 + i}T18:00:00Z`));
    await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-20T07:00:00Z'));
    await setFoodFavourite(db, foods.whey.id, true);

    const picks = await quickPicks(db, now);
    expect(picks.map((p) => p.name)).toEqual(['whey', 'Beef & sweet potato', 'Overnight oats']);
    expect(picks[1]).toMatchObject({ kind: 'recipe', defaultAmount: 1, unit: 'portion' });
    expect(picks[1].nutrients.kcal).toBeCloseTo(450.5, 10);
  });

  test('things not logged for over 14 days drop out unless favourited', async () => {
    const db = await migratedDb();
    const { overnightOats } = await seedRegulars(db);
    await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-06T07:00:00Z'));
    expect(await quickPicks(db, now)).toEqual([]);
  });

  test('a per-100 g food uses the amount you last logged', async () => {
    const db = await migratedDb();
    const { foods } = await seedRegulars(db);
    await logLoggable(db, { kind: 'food', id: foods.sweetPotato.id }, 250, at('2026-10-20T18:00:00Z'));
    const [pick] = await quickPicks(db, now);
    expect(pick).toMatchObject({ name: 'sweet-potato', defaultAmount: 250, unit: 'g' });
    expect(pick.nutrients.kcal).toBeCloseTo(215, 10);
  });

  test('a food saved as a meal shows once, as the meal', async () => {
    const db = await migratedDb();
    const { foods } = await seedRegulars(db);
    await logLoggable(db, { kind: 'food', id: foods.whey.id }, 1, at('2026-10-20T16:00:00Z'));
    await saveFoodAsMeal(db, foods.whey.id);
    const picks = await quickPicks(db, now);
    expect(picks.map((p) => `${p.kind}:${p.name}`)).toEqual(['recipe:whey']);
  });

  test('deleted items never appear', async () => {
    const db = await migratedDb();
    const { foods } = await seedRegulars(db);
    await setFoodFavourite(db, foods.whey.id, true);
    await deleteFood(db, foods.whey.id);
    expect(await quickPicks(db, now)).toEqual([]);
  });
});

test('sugar is snapshotted like the other nutrients, unknown when the food has none', async () => {
  const db = await migratedDb();
  const sweets = await createFood(db, {
    name: 'Jelly sweets',
    brand: null,
    barcode: null,
    basis: 'per_100g',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 340, proteinG: 6, carbsG: 77, fatG: 0, fibreG: 0, sugarG: 10 },
    dataSource: 'manual',
    notes: null,
  });
  const plain = await createFood(db, {
    name: 'Plain rice',
    brand: null,
    barcode: null,
    basis: 'per_100g',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fibreG: 0.4 },
    dataSource: 'manual',
    notes: null,
  });
  const a = await logLoggable(db, { kind: 'food', id: sweets.id }, 50, at('2026-10-21T15:00:00Z'));
  const b = await logLoggable(db, { kind: 'food', id: plain.id }, 100, at('2026-10-21T18:00:00Z'));
  expect(a.nutrients.sugarG).toBeCloseTo(5, 10);
  expect(b.nutrients.sugarG).toBeNull();
  const [first] = await entriesForDay(db, '2026-10-21');
  expect(first.nutrients.sugarG).toBeCloseTo(5, 10);
});
