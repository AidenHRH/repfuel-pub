import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood } from '@/database/repositories/foodRepository';
import type { FoodDraft, FoodProvider, SearchResult } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
const mockSearch = jest.fn<Promise<SearchResult>, [string]>();
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));
jest.mock('@/services/foodProvider', () => ({
  getFoodProvider: (): FoodProvider => ({ lookup: async () => ({ status: 'not_found' }), search: (q: string) => mockSearch(q) }),
}));

const appDir = path.resolve(__dirname, '../../src/app');

const thighs = (brand: string, shop: string, kcal: number): FoodDraft => ({
  name: 'Chicken thighs',
  brand,
  shop,
  basis: 'per_100g',
  servingSize: null,
  nutrients: { kcal, proteinG: 18, carbsG: 0, fatG: 12, fibreG: 0 },
  missing: [],
});

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // Thursday 12:30 London
  mockDb = await migratedDb();
  mockSearch.mockReset();
});
afterEach(() => jest.useRealTimers());

test('searching shows your own food first with when you had it, then each shop’s version', async () => {
  const mine = await createFood(mockDb, {
    name: 'Chicken thighs (boneless)',
    brand: 'Ashfield Farm',
    barcode: null,
    basis: 'per_100g',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 177, proteinG: 18, carbsG: 0, fatG: 11.6, fibreG: 0 },
    dataSource: 'open_food_facts',
    notes: null,
    shop: 'Aldi',
  });
  await logLoggable(mockDb, { kind: 'food', id: mine.id }, 200, new Date(2026, 9, 20, 18), 'dinner');
  mockSearch.mockResolvedValue({
    status: 'ok',
    hits: [
      { barcode: '1111111111116', imageUrl: null, draft: thighs('Birchwood', 'Lidl', 182) },
      { barcode: '2222222222224', imageUrl: null, draft: thighs('Tesco', 'Tesco', 190) },
    ],
  });

  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(await screen.findByLabelText('Search foods and meals'), 'chicken thighs');
  await fireEvent(screen.getByLabelText('Search foods and meals'), 'submitEditing');

  expect(await screen.findByText(/^Aldi · 177 kcal · per 100 g · You had this Tuesday$/)).toBeTruthy();
  expect(await screen.findByText('Birchwood · Lidl · per 100 g')).toBeTruthy();
  // A shop's own brand isn't said twice.
  expect(screen.getByText('Tesco · per 100 g')).toBeTruthy();
  expect(screen.getAllByText('Chicken thighs')).toHaveLength(2);
  expect(within(screen.getByLabelText(/Chicken thighs \(boneless\)/)).getByText(/You had this Tuesday/)).toBeTruthy();
});
