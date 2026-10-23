import type { Db } from '@/database/Db';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { listRecipes } from '@/database/repositories/recipeRepository';
import {
  getPlan,
  hasPlan,
  logPlannedMeal,
  makePlan,
  planCandidates,
  planDayKeys,
  planShoppingList,
  setDietPrefs,
  setShoppingTick,
  shoppingTicks,
  shuffleDay,
} from '@/database/repositories/mealPlanRepository';
import { DEFAULT_DIET } from '@/domain/diet';
import { getMealTemplate } from '@/domain/mealTemplates';

import { migratedDb, seedRegulars } from '../helpers/seed';

let db: Db;
const monday = new Date(2026, 9, 19, 9);
const days = planDayKeys(monday);

beforeEach(async () => {
  db = await migratedDb();
});

test('a week of meals is planned and saved', async () => {
  expect(await hasPlan(db, days)).toBe(false);
  await makePlan(db, { from: monday, seed: 1 });
  const plan = await getPlan(db, days);
  expect(plan.map((d) => d.day)).toEqual([
    '2026-10-19',
    '2026-10-20',
    '2026-10-21',
    '2026-10-22',
    '2026-10-23',
    '2026-10-24',
    '2026-10-25',
  ]);
  for (const d of plan) {
    expect(d.meals.map((m) => m.slot).slice(0, 3)).toEqual(['breakfast', 'lunch', 'dinner']);
    const kcal = d.meals.reduce((t, m) => t + m.kcal!, 0);
    expect(Math.abs(kcal - 2500)).toBeLessThan(200);
  }
});

test("the owner's own meals join the plan, at the meal they usually have them", async () => {
  const { overnightOats } = await seedRegulars(db);
  await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, new Date(2026, 9, 10, 8), 'breakfast');
  const candidates = await planCandidates(db, DEFAULT_DIET);
  expect(candidates.find((c) => c.id === overnightOats.id)).toMatchObject({ kind: 'recipe', slots: ['breakfast'] });
  expect(await planCandidates(db, { ...DEFAULT_DIET, useMyMeals: false })).not.toContainEqual(
    expect.objectContaining({ kind: 'recipe' }),
  );
});

test('a vegetarian plan has no meat or fish', async () => {
  await setDietPrefs(db, { ...DEFAULT_DIET, style: 'vegetarian' });
  await makePlan(db, { from: monday, seed: 3 });
  const meat = ['chicken-breast', 'chicken-thigh', 'salmon', 'tuna-can', 'prawns'];
  for (const d of await getPlan(db, days))
    for (const m of d.meals) expect(getMealTemplate(m.id)!.ingredients.some((i) => meat.includes(i.food))).toBe(false);
});

test('shuffling a day changes it and keeps the rest', async () => {
  await makePlan(db, { from: monday, seed: 1 });
  const before = await getPlan(db, days);
  await shuffleDay(db, days[2], 99);
  const after = await getPlan(db, days);
  expect(after[2].meals.map((m) => m.id)).not.toEqual(before[2].meals.map((m) => m.id));
  expect(after[1]).toEqual(before[1]);
  expect(after[3]).toEqual(before[3]);
});

test('logging a planned meal adds it to the diary, ticks it off, and keeps My meals tidy', async () => {
  await makePlan(db, { from: monday, seed: 1 });
  const [today] = await getPlan(db, days);
  const lunch = today.meals.find((m) => m.slot === 'lunch')!;
  const entry = await logPlannedMeal(db, today.day, 'lunch', new Date(2026, 9, 19, 12, 30));
  expect(entry).toMatchObject({ name: lunch.name, mealCategory: 'lunch', localDay: '2026-10-19' });
  expect(entry.nutrients.kcal).toBeCloseTo(lunch.kcal!, 0);
  expect((await getPlan(db, days))[0].meals.find((m) => m.slot === 'lunch')!.logged).toBe(true);
  expect(await listRecipes(db, {})).toEqual([]);
  expect(await entriesForDay(db, '2026-10-19')).toHaveLength(1);
});

test('the shopping list adds up the week and remembers ticks until the next plan', async () => {
  await makePlan(db, { from: monday, seed: 1 });
  const list = await planShoppingList(db, days);
  const items = list.flatMap((g) => g.items);
  expect(items.length).toBeGreaterThan(10);
  expect(new Set(items.map((i) => i.key)).size).toBe(items.length);
  await setShoppingTick(db, items[0].key, true);
  expect(await shoppingTicks(db)).toEqual(new Set([items[0].key]));
  await makePlan(db, { from: monday, seed: 2 });
  expect(await shoppingTicks(db)).toEqual(new Set());
});

test('a meal you usually log as a drink (a shake) never breaks a plan', async () => {
  const { overnightOats } = await seedRegulars(db);
  await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, new Date(2026, 9, 10, 8), 'drink');
  const shake = (await planCandidates(db, DEFAULT_DIET)).find((c) => c.id === overnightOats.id)!;
  expect(shake.slots.every((s) => ['breakfast', 'lunch', 'dinner', 'snack'].includes(s))).toBe(true);
  await makePlan(db, { from: monday, seed: 1 });
  expect((await getPlan(db, days)).every((d) => d.meals.length >= 3)).toBe(true);
});
