import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import type { FoodDraft } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

const crisps: FoodDraft = {
  name: 'Sea salt crisps',
  brand: 'Crunch',
  basis: 'per_100g',
  servingSize: 30,
  packSize: 300,
  nutrients: { kcal: 520, proteinG: 6, carbsG: 55, fatG: 30, fibreG: 4 },
  missing: [],
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T18:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('a bag with a known size: half the pack is 150 g of a 300 g pack', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(`/food/log?barcode=5000000000028&draft=${encodeURIComponent(JSON.stringify(crisps))}`));
  await screen.findByRole('header', { name: 'Sea salt crisps' });
  expect(screen.getByRole('button', { name: '1 serving · 30 g' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '1 pack · 300 g' }));
  await fireEvent.press(screen.getByRole('button', { name: '½' }));
  expect(screen.getByText('150 g of a 300 g pack')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Log ½ pack · 780 kcal' }));

  await screen.findByRole('button', { name: /^Choose a day/ });
  expect((await entriesForDay(mockDb, '2026-10-22'))[0]).toMatchObject({ amount: 150, unit: 'g' });
});
