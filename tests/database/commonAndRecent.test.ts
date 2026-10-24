import { logLoggable, recentItems } from '@/database/repositories/foodLogRepository';
import { deleteFood, listFoods, savePresetFood } from '@/database/repositories/foodRepository';
import { getCommonFood } from '@/domain/commonFoods';

import { migratedDb, seedRegulars } from '../helpers/seed';

const at = (iso: string) => new Date(iso);

test('a common food is saved once, the first time it is logged, with typical values', async () => {
  const db = await migratedDb();
  const blueberries = getCommonFood('blueberries')!;
  const food = await savePresetFood(db, blueberries);
  expect(food).toMatchObject({
    name: 'Blueberries',
    basis: 'per_100g',
    servingSize: 148,
    servingUnit: 'g',
    presetId: 'blueberries',
    dataSource: 'manual',
    notes: 'Typical values',
  });
  expect((await savePresetFood(db, blueberries)).id).toBe(food.id);
  await deleteFood(db, food.id);
  expect((await savePresetFood(db, blueberries)).id).not.toBe(food.id);
  expect(await listFoods(db, {})).toHaveLength(1);
});

test('recently had: what was logged lately, newest first, once each, with the usual amount', async () => {
  const db = await migratedDb();
  const { overnightOats, beefDinner, foods } = await seedRegulars(db);
  await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at('2026-10-19T18:00:00Z'));
  await logLoggable(db, { kind: 'food', id: foods.sweetPotato.id }, 200, at('2026-10-20T18:00:00Z'));
  await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-21T07:00:00Z'));
  await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at('2026-10-21T18:00:00Z'));

  const recent = await recentItems(db, at('2026-10-22T12:00:00Z'));
  expect(recent.map((r) => r.name)).toEqual(['Beef & sweet potato', 'Overnight oats', 'sweet-potato']);
  expect(recent[2]).toMatchObject({ defaultAmount: 200, unit: 'g' });

  await deleteFood(db, foods.sweetPotato.id);
  expect((await recentItems(db, at('2026-10-22T12:00:00Z'))).map((r) => r.name)).not.toContain('sweet-potato');
});

test('recent at a meal: what you usually have at that meal comes first', async () => {
  const db = await migratedDb();
  const { overnightOats, beefDinner } = await seedRegulars(db);
  await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at('2026-10-20T07:00:00Z'), 'breakfast');
  await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, at('2026-10-21T18:00:00Z'), 'dinner');
  const names = async (meal: 'breakfast' | 'dinner') =>
    (await recentItems(db, at('2026-10-22T12:00:00Z'), 12, meal)).map((r) => r.name);
  expect(await names('breakfast')).toEqual(['Overnight oats', 'Beef & sweet potato']);
  expect(await names('dinner')).toEqual(['Beef & sweet potato', 'Overnight oats']);
});
