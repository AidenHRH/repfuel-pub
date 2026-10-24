import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { setFoodFavourite } from '@/database/repositories/foodRepository';
import { quickAdd } from '@/database/repositories/snackRepository';

import { finishBasket } from '../helpers/basket';
import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London, lunchtime
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openLogFood() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
}

const headers = () => screen.getAllByRole('header').map((h) => h.props.children);

test('a fresh install: Scan barcode, Search food, Saved meals and More ways to add, nothing empty', async () => {
  await openLogFood();
  expect(screen.getByRole('button', { name: 'Scan barcode' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Search food' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Saved meals' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Quick meal' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Build a meal' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'New food' })).toBeTruthy();
  expect(headers()).toEqual(['Log food', 'More ways to add']);
  expect(screen.queryByLabelText('Search foods and meals')).toBeNull();
});

test('Scan barcode opens the camera for the chosen meal', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Scan barcode' }));
  expect(await screen.findByRole('header', { name: 'Scan barcode' })).toBeTruthy();
});

test('in order: Recent at the meal (3 at most), Favourites, Snacks, Drinks, More ways to add', async () => {
  const regulars = await seedRegulars(mockDb);
  const { foods } = regulars;
  await logLoggable(mockDb, { kind: 'recipe', id: regulars.beefDinner.id }, 1, new Date('2026-10-21T18:00:00Z'));
  await logLoggable(mockDb, { kind: 'recipe', id: regulars.overnightOats.id }, 1, new Date('2026-10-21T08:00:00Z'));
  await logLoggable(mockDb, { kind: 'food', id: foods.sweetPotato.id }, 200, new Date('2026-10-20T18:00:00Z'));
  await logLoggable(mockDb, { kind: 'recipe', id: regulars.pico.id }, 1, new Date('2026-10-19T12:00:00Z'));
  await setFoodFavourite(mockDb, foods.whey.id, true);
  await quickAdd(mockDb, { name: 'Protein bar', kcal: 200, proteinG: 20, mealCategory: 'snack', keepAsTile: true });
  await quickAdd(mockDb, { name: 'Iced latte', kcal: 120, proteinG: 7, mealCategory: 'drink', keepAsTile: true });
  await openLogFood();

  expect(await screen.findByRole('header', { name: 'Drinks' })).toBeTruthy();
  expect(headers()).toEqual(['Log food', 'Recent at lunch', 'Favourites', 'Snacks', 'Drinks', 'More ways to add']);
  // Three at most: Pico salad (had at lunch) first at lunchtime, then the newest; sweet potato (the fourth) isn't
  // shown, and nor are the tiles logged just now.
  expect(screen.getByRole('button', { name: 'Log 1 portion of Pico salad' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log 1 portion of Beef & sweet potato' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log 1 portion of Overnight oats' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Choose amount of sweet-potato' })).toBeNull();
  // A starred food is a Favourites tile.
  expect(screen.getByRole('button', { name: /^Log .* of whey$/ })).toBeTruthy();
});

test('a drink tile logs under Drinks, whatever the time', async () => {
  await quickAdd(mockDb, {
    name: 'Iced latte',
    kcal: 120,
    proteinG: 7,
    mealCategory: 'drink',
    keepAsTile: true,
    at: new Date('2026-10-01T09:00:00Z'),
  });
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Iced latte' }));

  await finishBasket();
  expect(await screen.findByRole('header', { name: 'Drinks' })).toBeTruthy();
  expect((await entriesForDay(mockDb, '2026-10-22'))[0]).toMatchObject({ mealCategory: 'drink' });
});
