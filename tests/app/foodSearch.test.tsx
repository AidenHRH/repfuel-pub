import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { listFoods } from '@/database/repositories/foodRepository';
import type { FoodDraft, FoodProvider, SearchResult } from '@/services/food-provider/types';

import { finishBasket } from '../helpers/basket';
import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
const mockSearch = jest.fn<Promise<SearchResult>, [string]>();
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));
jest.mock('@/services/foodProvider', () => ({
  getFoodProvider: (): FoodProvider => ({ lookup: async () => ({ status: 'not_found' }), search: (q: string) => mockSearch(q) }),
}));

const appDir = path.resolve(__dirname, '../../src/app');

const kitkat: FoodDraft = {
  name: 'KitKat 4 Finger',
  brand: 'Nestlé',
  basis: 'per_100g',
  servingSize: 41.5,
  imageUrl: 'https://images.openfoodfacts.org/kitkat.200.jpg',
  nutrients: { kcal: 518, proteinG: 6.6, carbsG: 60, fatG: 27, fibreG: 2 },
  missing: [],
  health: { nutriscore: 'e', nova: 4, additives: ['E322', 'E476'] },
};
const chunky: FoodDraft = {
  ...kitkat,
  name: 'KitKat Chunky',
  servingSize: 40,
  imageUrl: undefined,
  nutrients: { ...kitkat.nutrients, proteinG: null },
  missing: ['proteinG'],
};

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London
  mockDb = await migratedDb();
  await seedRegulars(mockDb);
  mockSearch.mockReset();
});
afterEach(() => jest.useRealTimers());

async function searchFor(query: string) {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(await screen.findByLabelText('Search foods and meals'), query);
  await fireEvent(screen.getByLabelText('Search foods and meals'), 'submitEditing');
}

test('search for a KitKat, pick how much, file it under Snacks', async () => {
  mockSearch.mockResolvedValue({
    status: 'ok',
    hits: [
      { barcode: '7613035239104', imageUrl: kitkat.imageUrl!, draft: kitkat },
      { barcode: null, imageUrl: null, draft: chunky },
    ],
  });
  await searchFor('kitkat');

  expect(mockSearch).toHaveBeenCalledWith('kitkat');
  expect(await screen.findByLabelText('KitKat 4 Finger picture')).toBeTruthy();
  expect(screen.getAllByLabelText('Nutri-Score E').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: /^Choose KitKat 4 Finger/ }));

  await screen.findByRole('header', { name: 'KitKat 4 Finger' });
  expect(screen.getByText('1 serving = 41.5 g')).toBeTruthy();
  // Like Yuka: a verdict and the reasons for it.
  expect(screen.getByLabelText('Rated Poor')).toBeTruthy();
  expect(screen.getByText('• Nutri-Score E: a bad nutritional balance')).toBeTruthy();
  expect(screen.getByText('• Ultra-processed (NOVA 4)')).toBeTruthy();
  expect(screen.getByText('Additives: E322, E476')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '½' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Snack' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Log 20\.75 g · / }));

  await finishBasket();
  expect(await screen.findByLabelText('Calories 107 of 2,500. Protein 1 of 145 grams.')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Snacks' })).toBeTruthy();
  const saved = (await listFoods(mockDb, { search: 'kitkat' }))[0];
  expect(saved).toMatchObject({ barcode: '7613035239104', imageUrl: kitkat.imageUrl, health: kitkat.health });
});

test('a result missing protein is checked before it is saved', async () => {
  mockSearch.mockResolvedValue({ status: 'ok', hits: [{ barcode: null, imageUrl: null, draft: chunky }] });
  await searchFor('chunky');
  await fireEvent.press(await screen.findByRole('button', { name: /^Choose KitKat Chunky/ }));
  expect(await screen.findByRole('header', { name: 'Check product' })).toBeTruthy();
});

test('suggestions show as you type; the shops are searched once typing pauses', async () => {
  mockSearch.mockResolvedValue({ status: 'ok', hits: [] });
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  await fireEvent.changeText(await screen.findByLabelText('Search foods and meals'), 'oats');
  expect(await screen.findByRole('header', { name: 'Suggested' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log 1 portion of Overnight oats' })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Choose Porridge oats/ })).toBeTruthy();
  expect(mockSearch).not.toHaveBeenCalled();
  await act(async () => {
    await jest.advanceTimersByTimeAsync(800);
  });
  expect(mockSearch).toHaveBeenCalledWith('oats');
  expect(mockSearch).toHaveBeenCalledTimes(1);
});

test('shop results: the best match first, then more results', async () => {
  const wafer = {
    ...chunky,
    name: 'Wafer bar, KitKat style',
    brand: 'Own brand',
    proteinG: 5,
    nutrients: { ...chunky.nutrients, proteinG: 5 },
    missing: [],
  };
  mockSearch.mockResolvedValue({
    status: 'ok',
    hits: [
      { barcode: '1111111111111', imageUrl: null, draft: wafer },
      { barcode: '7613035239104', imageUrl: kitkat.imageUrl!, draft: kitkat },
    ],
  });
  await searchFor('kitkat');
  expect(await screen.findByRole('header', { name: 'Best match' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'More results' })).toBeTruthy();
  const order = screen.getAllByRole('button', { name: /^Choose / }).map((b) => b.props.accessibilityLabel);
  expect(order[0]).toMatch(/^Choose KitKat 4 Finger/);
  expect(order[1]).toMatch(/^Choose Wafer bar/);
});

test('problems searching are explained, and saved foods still work', async () => {
  mockSearch.mockResolvedValue({ status: 'error', reason: 'busy' });
  await searchFor('kitkat');
  expect(await screen.findByText(/searched a lot/i)).toBeTruthy();

  mockSearch.mockResolvedValue({ status: 'error', reason: 'offline' });
  await fireEvent(screen.getByLabelText('Search foods and meals'), 'submitEditing');
  expect(await screen.findByText(/no internet connection/i)).toBeTruthy();

  mockSearch.mockResolvedValue({ status: 'ok', hits: [] });
  await fireEvent.changeText(screen.getByLabelText('Search foods and meals'), 'zzzz');
  await fireEvent(screen.getByLabelText('Search foods and meals'), 'submitEditing');
  expect(await screen.findByText(/nothing on open food facts/i)).toBeTruthy();
});

test('a shop product can be logged straight from the results with +', async () => {
  mockSearch.mockResolvedValue({ status: 'ok', hits: [{ barcode: '7613035239104', imageUrl: kitkat.imageUrl!, draft: kitkat }] });
  await searchFor('kitkat');
  expect(await screen.findByText('215 kcal · 2.7 P · 24.9 C · 11.2 F')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Log 1 serving of KitKat 4 Finger' }));
  await finishBasket();
  expect(await screen.findByText('Logged KitKat 4 Finger')).toBeTruthy();
});

test('Search food: what are you having, with a scan button beside it', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Search food' }));
  expect((await screen.findByLabelText('Search foods and meals')).props.placeholder).toBe('What are you having?');
  await fireEvent.press(screen.getByRole('button', { name: 'Scan a barcode' }));
  expect(await screen.findByRole('header', { name: 'Scan barcode' })).toBeTruthy();
});

test('the product page: big numbers, favourite star, and a Log button with calories', async () => {
  mockSearch.mockResolvedValue({ status: 'ok', hits: [{ barcode: '7613035239104', imageUrl: kitkat.imageUrl!, draft: kitkat }] });
  await searchFor('kitkat');
  await fireEvent.press(await screen.findByRole('button', { name: /^Choose KitKat 4 Finger/ }));
  await screen.findByRole('header', { name: 'KitKat 4 Finger' });
  expect(screen.getByLabelText('Calories 215')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Favourite' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Log 41.5 g · 215 kcal' }));
  await finishBasket();
  const saved = (await listFoods(mockDb, { search: 'kitkat' }))[0];
  expect(saved.isFavourite).toBe(true);
});
