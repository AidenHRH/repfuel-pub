import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { skippedMeals } from '@/database/repositories/dayRepository';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood } from '@/database/repositories/foodRepository';
import type { FoodProduct } from '@/domain/types';

import { finishBasket } from '../helpers/basket';
import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
let plate: FoodProduct;
let cola: FoodProduct;

const food = (name: string, basis: 'per_serving' | 'per_100ml', kcal: number, proteinG: number) =>
  createFood(mockDb, {
    name,
    brand: null,
    barcode: null,
    basis,
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal, proteinG, carbsG: 0, fatG: 0, fibreG: 0 },
    dataSource: 'manual',
    notes: null,
    isFavourite: false,
  });

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T12:30:00Z'), advanceTimers: true }); // Thursday 13:30 in London
  mockDb = await migratedDb();
  plate = await food('Big plate', 'per_serving', 830, 50);
  cola = await food('Cola', 'per_100ml', 42, 0);
  // Wednesday: breakfast, lunch and dinner, 2,490 kcal and 150 g protein against 2,500 and 145: goals hit.
  for (const [hour, meal] of [
    [8, 'breakfast'],
    [12, 'lunch'],
    [18, 'dinner'],
  ] as const)
    await logLoggable(mockDb, { kind: 'food', id: plate.id }, 1, new Date(2026, 9, 21, hour), meal);
  // Tuesday: lunch only.
  await logLoggable(mockDb, { kind: 'food', id: plate.id }, 1, new Date(2026, 9, 20, 12), 'lunch');
});
afterEach(() => jest.useRealTimers());

async function openSummary() {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Summary' });
}

test('the week’s dots show each day’s stage, with the streak beside Today', async () => {
  await openSummary();
  expect(await screen.findByRole('button', { name: 'Yesterday, goals hit' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Tue 20 Oct, partly logged' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Mon 19 Oct, nothing logged' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Today, nothing logged' }).props.accessibilityState.selected).toBe(true);
  expect(screen.getByLabelText('1-day streak')).toBeTruthy();
});

test('a dot opens that day; Log adds to that day, not today', async () => {
  await openSummary();
  await fireEvent.press(await screen.findByRole('button', { name: 'Tue 20 Oct, partly logged' }));
  expect(await screen.findByRole('button', { name: 'Choose a day, showing Tue 20 Oct' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: /^Big plate, 12:00/ })).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Log dinner' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'big');
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Big plate' }));

  await finishBasket();
  expect(await screen.findByRole('button', { name: /^Big plate, 18:30/ })).toBeTruthy();
  expect(await entriesForDay(mockDb, '2026-10-20')).toHaveLength(2);
  const dinner = (await entriesForDay(mockDb, '2026-10-20')).find((e) => e.mealCategory === 'dinner')!;
  expect(new Date(dinner.loggedAt).toTimeString().slice(0, 5)).toBe('18:30'); // dinner's usual time
  expect(await entriesForDay(mockDb, '2026-10-22')).toHaveLength(0);

  await fireEvent.press(await screen.findByRole('button', { name: 'Back to today' }));
  expect(await screen.findByText('Nothing logged yet today')).toBeTruthy();
});

test('hold an entry to log it again today, in the meal you choose', async () => {
  await openSummary();
  await fireEvent.press(await screen.findByRole('button', { name: 'Yesterday, goals hit' }));
  await fireEvent(await screen.findByRole('button', { name: /^Big plate, 18:00/ }), 'longPress');
  expect(await screen.findByRole('header', { name: 'Log again today' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Lunch' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Dinner' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Log at dinner' }));

  expect(await screen.findByText('Logged Big plate')).toBeTruthy();
  const [copy] = await entriesForDay(mockDb, '2026-10-22');
  expect(copy).toMatchObject({ name: 'Big plate', mealCategory: 'dinner', amount: 1 });
});

test('a missed breakfast on a past day can be marked skipped', async () => {
  await openSummary();
  await fireEvent.press(await screen.findByRole('button', { name: 'Tue 20 Oct, partly logged' }));
  await fireEvent.press(await screen.findByRole('switch', { name: 'Skipped breakfast' }));
  expect(await screen.findByRole('switch', { name: 'Skipped breakfast', checked: true })).toBeTruthy();
  expect(await skippedMeals(mockDb, '2026-10-20')).toEqual(['breakfast']);
  expect(await screen.findByRole('button', { name: 'Tue 20 Oct, partly logged' })).toBeTruthy();
});

test('drinks today add up as liquid calories, wherever they were logged', async () => {
  await logLoggable(mockDb, { kind: 'food', id: cola.id }, 330, new Date(2026, 9, 22, 12, 10), 'lunch');
  await logLoggable(mockDb, { kind: 'food', id: cola.id }, 500, new Date(2026, 9, 22, 13), 'drink');
  await openSummary();
  await fireEvent.press(await screen.findByRole('button', { name: 'Drinks today: 2 · 349 kcal' }));
  expect(await screen.findByText('Lunch · 330 ml')).toBeTruthy();
  expect(screen.getByText('Drink · 500 ml')).toBeTruthy();
});

test('the week view lists protein and calories per day against the targets', async () => {
  await openSummary();
  await fireEvent.press(await screen.findByRole('button', { name: 'Week view' }));
  expect(await screen.findByText('1 of 4 days on target')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Yesterday: protein 150 of 145 grams, 2,490 of 2,500 calories' })).toBeTruthy();
});
