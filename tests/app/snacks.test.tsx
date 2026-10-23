import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { quickAdd } from '@/database/repositories/snackRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London, lunchtime
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openToday() {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Summary' });
}

/** Snacks & drinks tiles live at the top of Log food. */
async function openLogFood() {
  await openToday();
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
}

test('one tap on a tile logs it under Snacks, whatever the time', async () => {
  await quickAdd(mockDb, {
    name: 'Protein bar',
    kcal: 200,
    proteinG: 20,
    mealCategory: 'snack',
    keepAsTile: true,
    at: new Date('2026-10-21T15:00:00Z'),
  });
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Protein bar' }));

  await screen.findByRole('header', { name: 'Summary' });
  expect(await screen.findByText('Logged Protein bar')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Snacks' })).toBeTruthy();
});

test('hold a tile to remove it from the row', async () => {
  // Logged weeks ago, so once off the row it isn't a recent pick in My meals either.
  await quickAdd(mockDb, {
    name: 'Protein bar',
    kcal: 200,
    proteinG: 20,
    mealCategory: 'snack',
    keepAsTile: true,
    at: new Date('2026-09-20T15:00:00Z'),
  });
  await openLogFood();
  await fireEvent(await screen.findByRole('button', { name: 'Log 1 serving of Protein bar' }), 'longPress');
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove from Snacks' }));

  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  expect(screen.queryByRole('button', { name: 'Log 1 serving of Protein bar' })).toBeNull();
});

test('a saved food can be put in the row from its edit screen', async () => {
  const { foods } = await seedRegulars(mockDb);
  await openToday();
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(`/food/${foods.whey.id}`));
  await fireEvent(await screen.findByLabelText('Show in Snacks'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await screen.findByRole('header', { name: 'Summary' });
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  expect(await screen.findByRole('button', { name: 'Log 1 serving of whey' })).toBeTruthy();
});

test('a saved drink can be put in the Drinks row from its edit screen', async () => {
  const { foods } = await seedRegulars(mockDb);
  await openToday();
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(`/food/${foods.milk.id}`));
  await fireEvent(await screen.findByLabelText('Show in Drinks'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  await screen.findByRole('header', { name: 'Summary' });
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  expect(await screen.findByRole('header', { name: 'Drinks' })).toBeTruthy();
});

test('hold a tile to log half of it', async () => {
  await quickAdd(mockDb, {
    name: 'Chocolate bar',
    kcal: 240,
    proteinG: 4,
    mealCategory: 'snack',
    keepAsTile: true,
    at: new Date('2026-09-20T15:00:00Z'),
  });
  await openLogFood();
  await fireEvent(await screen.findByRole('button', { name: 'Log 1 serving of Chocolate bar' }), 'longPress');
  for (const portion of ['¼ serving', '½ serving', '¾ serving', '1 serving', '1½ servings', '2 servings']) {
    expect(await screen.findByRole('button', { name: `Log ${portion}` })).toBeTruthy();
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Log ½ serving' }));

  await screen.findByRole('header', { name: 'Summary' });
  expect(await screen.findByText('Logged Chocolate bar')).toBeTruthy();
  expect(screen.getByText('≈ 120 kcal · 2 g')).toBeTruthy();
});

test('search for a snack, and keep it as a tile for next time', async () => {
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Snack' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'latte');
  await fireEvent.press(await screen.findByRole('button', { name: /^Choose Latte/ }));

  await screen.findByRole('header', { name: 'Latte' });
  await fireEvent(screen.getByLabelText('Add to Snacks'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: /^Log 350 ml · / }));

  await screen.findByRole('header', { name: 'Summary' });
  expect(await screen.findByText('Logged Latte')).toBeTruthy();
  await act(async () => jest.requireActual('expo-router').router.push('/log-food'));
  expect(await screen.findByRole('button', { name: 'Log 350 ml of Latte' })).toBeTruthy();
});

test('Add next to Food opens the search, ready to type', async () => {
  await openToday();
  await fireEvent.press(await screen.findByRole('button', { name: 'Add' }));
  expect(await screen.findByRole('header', { name: 'Search food' })).toBeTruthy();
  expect(screen.getByLabelText('Search foods and meals').props.autoFocus).toBe(true);
});
