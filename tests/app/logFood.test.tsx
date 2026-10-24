import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { listRecipes } from '@/database/repositories/recipeRepository';

import { finishBasket } from '../helpers/basket';
import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-21T17:30:00Z'), advanceTimers: true }); // 18:30 London
  mockDb = await migratedDb();
  await seedRegulars(mockDb);
});
afterEach(() => jest.useRealTimers());

async function openLogFood() {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('button', { name: /^Choose a day/ });
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
}

test('a quick meal is saved once, logged, and ready to log again in one tap', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Quick meal' }));
  await screen.findByRole('header', { name: 'Quick meal' });

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Gousto katsu');
  await fireEvent.changeText(screen.getByLabelText('Calories'), '650');
  await fireEvent.changeText(screen.getByLabelText('Protein'), '40');
  await fireEvent.press(screen.getByRole('button', { name: 'Save and log' }));

  await finishBasket();
  expect(await screen.findByLabelText('Calories 650 of 2,500. Protein 40 of 145 grams.')).toBeTruthy();
  expect(screen.getByText('≈ 650')).toBeTruthy();
  // Saved to My meals by default, so it logs again in one tap as a meal.
  await act(async () => jest.requireActual('expo-router').router.push('/log-food'));
  expect(await screen.findByRole('button', { name: 'Log 1 portion of Gousto katsu' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Log 1 serving of Gousto katsu' })).toBeNull();
});

test('a quick meal saved as a meal is listed once when searching', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Quick meal' }));
  await screen.findByRole('header', { name: 'Quick meal' });
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Gousto katsu');
  await fireEvent.changeText(screen.getByLabelText('Calories'), '650');
  await fireEvent.changeText(screen.getByLabelText('Protein'), '40');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  // Saved without logging: back on Log food, nothing in the basket.
  await screen.findByRole('header', { name: 'Log food' });
  expect(screen.queryByRole('button', { name: /^Log \d+ items?$/ })).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(await screen.findByLabelText('Search foods and meals'), 'katsu');
  expect(await screen.findByRole('button', { name: 'Log 1 portion of Gousto katsu' })).toBeTruthy();
  expect(screen.getAllByText('Gousto katsu')).toHaveLength(1);
});

test('a quick meal can skip My meals', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Quick meal' }));
  await screen.findByRole('header', { name: 'Quick meal' });
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Office cake');
  await fireEvent.changeText(screen.getByLabelText('Calories'), '300');
  await fireEvent.changeText(screen.getByLabelText('Protein'), '4');
  await fireEvent(screen.getByLabelText('Save to My meals'), 'valueChange', false);
  await fireEvent.press(screen.getByRole('button', { name: 'Save and log' }));

  await finishBasket();
  expect(await screen.findByText('Logged Office cake')).toBeTruthy();
  expect(await listRecipes(mockDb, { search: 'Office cake' })).toEqual([]);
});

test('a quick meal named like an existing meal asks for another name', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Quick meal' }));
  await screen.findByRole('header', { name: 'Quick meal' });
  await fireEvent.changeText(screen.getByLabelText('Name'), 'overnight oats');
  await fireEvent.changeText(screen.getByLabelText('Calories'), '400');
  await fireEvent.changeText(screen.getByLabelText('Protein'), '30');
  await fireEvent.press(screen.getByRole('button', { name: 'Save and log' }));
  expect(await screen.findByText(/already have a meal called/)).toBeTruthy();
});

test('search finds saved meals and + logs them', async () => {
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'beef');
  expect(screen.queryByText('Overnight oats')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Log 1 portion of Beef & sweet potato' }));

  await finishBasket();
  expect(await screen.findByLabelText('Calories 451 of 2,500. Protein 37 of 145 grams.')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Dinner' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Beef & sweet potato, 18:30/ })).toBeTruthy();
});

test('a per-100 g food asks how much before logging', async () => {
  await openLogFood();
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'sweet');
  await fireEvent.press(screen.getByRole('button', { name: 'Choose amount of sweet-potato' }));
  await fireEvent.changeText(await screen.findByLabelText('Amount'), '200');
  await fireEvent.press(screen.getByRole('button', { name: /^Log 200 g · / }));

  await finishBasket();
  expect(await screen.findByLabelText('Calories 172 of 2,500. Protein 3 of 145 grams.')).toBeTruthy();
});

test('Search food opens its own screen, ready to type, and logging closes back to Summary', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Search food' }));
  await screen.findByRole('header', { name: 'Search food' });
  expect(screen.getByLabelText('Search foods and meals').props.autoFocus).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'beef');
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 portion of Beef & sweet potato' }));
  await finishBasket();
  expect(await screen.findByText('Logged Beef & sweet potato')).toBeTruthy();
});

test('Saved meals lists your meals, starred first, one tap each', async () => {
  await openLogFood();
  await fireEvent.press(screen.getByRole('button', { name: 'Saved meals' }));
  await screen.findByRole('header', { name: 'Saved meals' });
  expect(screen.queryByLabelText('Search foods and meals')).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 portion of Overnight oats' }));
  await finishBasket();
  expect(await screen.findByText('Logged Overnight oats')).toBeTruthy();
});
