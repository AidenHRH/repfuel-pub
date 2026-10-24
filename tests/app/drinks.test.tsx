import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { listFoods } from '@/database/repositories/foodRepository';
import { isInDrinksRow } from '@/database/repositories/snackRepository';
import type { FoodDraft } from '@/services/food-provider/types';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

const cola: FoodDraft = {
  name: 'Cola',
  brand: 'Fizz',
  basis: 'per_100ml',
  servingSize: null,
  nutrients: { kcal: 42, proteinG: 0, carbsG: 10.6, fatG: 0, fibreG: 0 },
  missing: [],
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function open(url: string, header: string) {
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(url));
  await screen.findByRole('header', { name: header });
}

test('a drink with no size of its own: cans, glasses and bottles, logged under Drinks', async () => {
  await open(`/food/log?barcode=5000112637922&draft=${encodeURIComponent(JSON.stringify(cola))}`, 'Cola');
  expect(screen.getByRole('button', { name: 'Drink' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: '1 can · 330 ml' }));
  await fireEvent.changeText(screen.getByLabelText('How many'), '2');
  await fireEvent(screen.getByLabelText('Add to Drinks'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Log 660 ml · 277 kcal' }));

  await screen.findByRole('button', { name: /^Choose a day/ });
  expect(await screen.findByRole('header', { name: 'Drinks' })).toBeTruthy();
  expect((await entriesForDay(mockDb, '2026-10-22'))[0]).toMatchObject({ mealCategory: 'drink', amount: 660, unit: 'ml' });
  const saved = (await listFoods(mockDb, { search: 'cola' }))[0];
  expect(await isInDrinksRow(mockDb, saved.id)).toBe(true);
});

test('a latte keeps its coffee-shop sizes', async () => {
  await open('/food/log?preset=latte', 'Latte');
  expect(screen.getByRole('button', { name: 'Medium · 350 ml' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Large · 450 ml' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Drink' }).props.accessibilityState.selected).toBe(true);
});

test('a snack offers Add to Snacks, a drink Add to Drinks', async () => {
  await open('/food/log?preset=banana&meal=snack', 'Banana');
  expect(screen.getByLabelText('Add to Snacks')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Drink' }));
  expect(screen.getByLabelText('Add to Drinks')).toBeTruthy();
  expect(screen.queryByLabelText('Add to Snacks')).toBeNull();
});
