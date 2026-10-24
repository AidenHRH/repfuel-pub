import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood } from '@/database/repositories/foodRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
let regulars: Awaited<ReturnType<typeof seedRegulars>>;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London: lunch
  mockDb = await migratedDb();
  regulars = await seedRegulars(mockDb);
});
afterEach(() => jest.useRealTimers());

async function openLogFood() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
}

test('choose the meal first; everything logged from here goes to it', async () => {
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  expect(screen.getByRole('button', { name: 'Lunch' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Snack' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'oats');
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 portion of Overnight oats' }));

  await screen.findByRole('header', { name: 'Summary' });
  expect(await screen.findByRole('header', { name: 'Snacks' })).toBeTruthy();
  const [entry] = await entriesForDay(mockDb, '2026-10-22');
  expect(entry.mealCategory).toBe('snack');
});

test('recently had foods and meals are ready to log again', async () => {
  await logLoggable(mockDb, { kind: 'recipe', id: regulars.beefDinner.id }, 1, new Date('2026-10-21T18:00:00Z'));
  await logLoggable(mockDb, { kind: 'food', id: regulars.foods.sweetPotato.id }, 200, new Date('2026-10-20T18:00:00Z'));
  await openLogFood();
  expect(screen.getByRole('header', { name: 'Recent' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Log 1 portion of Beef & sweet potato' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Choose amount of sweet-potato' })).toBeTruthy();
});

test('a cup of blueberries: common foods come with household measures', async () => {
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Breakfast' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'blueb');
  await fireEvent.press(await screen.findByRole('button', { name: /^Choose Blueberries/ }));

  await screen.findByRole('header', { name: 'Blueberries' });
  expect(screen.getByRole('button', { name: '1 cup · 148 g' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Breakfast' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: '1 handful · 40 g' }));
  await fireEvent.press(screen.getByRole('button', { name: '1 cup · 148 g' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Log 148 g · / }));

  await screen.findByRole('header', { name: 'Summary' });
  expect(await screen.findByLabelText('Calories 84 of 2,500. Protein 1 of 145 grams.')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Breakfast' })).toBeTruthy();
});

test('macros start at one serving and follow the amount', async () => {
  const bar = await createFood(mockDb, {
    name: 'Protein bar',
    brand: 'Test',
    barcode: null,
    basis: 'per_100g',
    servingSize: 50,
    servingUnit: 'g',
    nutrients: { kcal: 380, proteinG: 20, carbsG: 40, fatG: 12, fibreG: null },
    dataSource: 'manual',
    notes: null,
  });
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(`/food/log?id=${bar.id}`));

  await screen.findByRole('header', { name: 'Protein bar' });
  expect(screen.getByLabelText('Calories 190')).toBeTruthy();
  expect(screen.getByLabelText('Protein 10 g')).toBeTruthy();
  expect(screen.getByLabelText('Carbs 20 g')).toBeTruthy();
  expect(screen.getByLabelText('Fat 6 g')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Amount'), '100');
  expect(screen.getByLabelText('Protein 20 g')).toBeTruthy();
  expect(screen.getByLabelText('Carbs 40 g')).toBeTruthy();
  expect(screen.getByLabelText('Fat 12 g')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log 100 g · 380 kcal' })).toBeTruthy();
});

test('any number of a measure: three handfuls of blueberries', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push('/food/log?preset=blueberries&meal=breakfast'));
  await screen.findByRole('header', { name: 'Blueberries' });
  await fireEvent.press(screen.getByRole('button', { name: '1 handful · 40 g' }));
  await fireEvent.changeText(screen.getByLabelText('How many'), '3');
  expect(screen.getByLabelText('Amount').props.value).toBe('120');
  expect(screen.getByRole('button', { name: 'Log 120 g · 68 kcal' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'One more' }));
  expect(screen.getByLabelText('How many').props.value).toBe('4');
  expect(screen.getByLabelText('Amount').props.value).toBe('160');
  await fireEvent.press(screen.getByRole('button', { name: 'One fewer' }));
  await fireEvent.press(screen.getByRole('button', { name: 'One fewer' }));
  expect(screen.getByLabelText('How many').props.value).toBe('2');
});

test('servings can be any number too', async () => {
  const katsu = await createFood(mockDb, {
    name: 'Gousto katsu',
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 650, proteinG: 40, carbsG: null, fatG: null, fibreG: null },
    dataSource: 'manual',
    notes: null,
  });
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(`/food/log?id=${katsu.id}`));
  await screen.findByRole('header', { name: 'Gousto katsu' });
  await fireEvent.press(screen.getByRole('button', { name: 'One more' }));
  await fireEvent.press(screen.getByRole('button', { name: 'One more' }));
  expect(screen.getByRole('button', { name: 'Log 3 servings · 1,950 kcal' })).toBeTruthy();
});
