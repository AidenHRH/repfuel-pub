import { renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood, savePresetFood } from '@/database/repositories/foodRepository';
import { getCommonFood } from '@/domain/commonFoods';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T12:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('Summary shows each item’s photo: the pack’s, a built-in food’s, else a letter tile', async () => {
  const pack = await createFood(mockDb, {
    name: 'Meal deal sandwich',
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 420, proteinG: 24, carbsG: 40, fatG: 16, fibreG: 3 },
    dataSource: 'open_food_facts',
    notes: null,
    imageUrl: 'https://images.openfoodfacts.org/sandwich.jpg',
  });
  const banana = await savePresetFood(mockDb, getCommonFood('banana')!);
  const mine = await createFood(mockDb, {
    name: 'Mum’s flapjack',
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 300, proteinG: 4, carbsG: 40, fatG: 14, fibreG: 3 },
    dataSource: 'manual',
    notes: null,
  });
  await logLoggable(mockDb, { kind: 'food', id: pack.id }, 1, new Date(2026, 9, 22, 12, 0), 'lunch');
  await logLoggable(mockDb, { kind: 'food', id: banana.id }, 118, new Date(2026, 9, 22, 12, 5), 'lunch');
  await logLoggable(mockDb, { kind: 'food', id: mine.id }, 1, new Date(2026, 9, 22, 12, 10), 'lunch');
  await renderRouter(appDir, { initialUrl: '/' });

  const sandwich = await screen.findByLabelText('Meal deal sandwich picture');
  expect(sandwich.props.source).toEqual([{ uri: 'https://images.openfoodfacts.org/sandwich.jpg' }]);
  expect(screen.getByLabelText('Banana picture').props.source[0].uri).toMatch(
    /themealdb\.com\/images\/ingredients\/Banana-Small\.png$/,
  );
  expect(screen.queryByLabelText('Mum’s flapjack picture')).toBeNull();
  expect(screen.getAllByTestId('food-letter', { includeHiddenElements: true }).length).toBeGreaterThan(0);
});
