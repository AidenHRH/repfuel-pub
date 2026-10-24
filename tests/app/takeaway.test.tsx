import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { listFoods } from '@/database/repositories/foodRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T18:30:00Z'), advanceTimers: true }); // 19:30 London: dinner
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openTakeaway() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Takeaway estimates' }));
  await screen.findByRole('header', { name: 'Takeaway' });
}

test('a Chinese: chicken chow mein, regular, goes in the basket marked ≈', async () => {
  await openTakeaway();
  await fireEvent.press(screen.getByRole('button', { name: 'Chicken chow mein' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Regular Chicken chow mein, about \d+ kcal/ }));

  expect(await screen.findByRole('header', { name: 'Your dinner · 1 item' })).toBeTruthy();
  const [entry] = await entriesForDay(mockDb, '2026-10-22');
  expect(entry).toMatchObject({ name: 'Chicken chow mein (takeaway, regular)', mealCategory: 'dinner', isApproximate: true });
  expect(entry.nutrients.kcal).toBeGreaterThan(700);
});

test('pizza is by the slice, and the same dish again reuses its saved food', async () => {
  await openTakeaway();
  await fireEvent.press(screen.getByRole('button', { name: 'Pizza' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Pepperoni pizza, ≈ \d+ kcal a slice$/ }));
  await screen.findByRole('header', { name: 'Your dinner · 1 item' });
  await fireEvent.press(screen.getByRole('button', { name: 'Takeaway estimates' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Pizza' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Pepperoni pizza, ≈ \d+ kcal a slice$/ }));

  expect(await screen.findByRole('header', { name: 'Your dinner · 2 items' })).toBeTruthy();
  expect((await listFoods(mockDb, { search: 'pepperoni' })).map((f) => f.name)).toEqual(['Pepperoni pizza (takeaway, a slice)']);
});
