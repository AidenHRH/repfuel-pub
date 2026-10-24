import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { findFoodByBarcode } from '@/database/repositories/barcodeRepository';
import { createFood, getFood, shopUnasked } from '@/database/repositories/foodRepository';
import type { FoodDraft } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

const thighs: FoodDraft = {
  name: 'Chicken thighs',
  brand: 'Corner Butchers',
  basis: 'per_100g',
  servingSize: 150,
  nutrients: { kcal: 180, proteinG: 18, carbsG: 0, fatG: 12, fibreG: 0 },
  missing: [],
};

const openProduct = (draft: FoodDraft, barcode: string) =>
  renderRouter(appDir, {
    initialUrl: `/food/log?draft=${encodeURIComponent(JSON.stringify(draft))}&barcode=${barcode}`,
  });

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T12:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('a pack with no known shop asks where it’s from; the pick is saved with it', async () => {
  await openProduct(thighs, '5000000000017');
  expect(await screen.findByText('Where’s this from?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Aldi' }));
  expect(screen.getByText('Corner Butchers · Aldi')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Log / }));
  const saved = await findFoodByBarcode(mockDb, '5000000000017');
  expect(saved?.shop).toBe('Aldi');
});

test('Skip logs without a shop and the question isn’t asked again', async () => {
  await openProduct(thighs, '5000000000024');
  await fireEvent.press(await screen.findByRole('button', { name: 'Skip the shop' }));
  expect(screen.queryByText('Where’s this from?')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Log / }));
  const saved = (await findFoodByBarcode(mockDb, '5000000000024'))!;
  expect(saved.shop).toBeNull();
  expect(await shopUnasked(mockDb, saved.id)).toBe(false);
});

test('a known shop is shown, not asked', async () => {
  await openProduct({ ...thighs, brand: 'Birchwood', shop: 'Lidl' }, '5000000000031');
  expect(await screen.findByText('Birchwood · Lidl')).toBeTruthy();
  expect(screen.queryByText('Where’s this from?')).toBeNull();
});

test('the shop can be changed on the food’s page', async () => {
  const food = await createFood(mockDb, {
    ...thighs,
    name: 'Chicken thighs',
    barcode: '5000000000048',
    servingUnit: null,
    dataSource: 'open_food_facts',
    notes: null,
    shop: 'Aldi',
  });
  await renderRouter(appDir, { initialUrl: `/food/${food.id}` });
  expect((await screen.findByRole('button', { name: 'Aldi' })).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Tesco' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect((await getFood(mockDb, food.id))?.shop).toBe('Tesco');
});
