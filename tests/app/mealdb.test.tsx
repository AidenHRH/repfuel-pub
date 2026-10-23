import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { getFood } from '@/database/repositories/foodRepository';
import { getRecipe, listRecipes } from '@/database/repositories/recipeRepository';
import { createMealDb, splitSteps } from '@/services/mealdb';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

const MEAL = {
  idMeal: '52795',
  strMeal: 'Chicken Handi',
  strMealThumb: 'https://www.themealdb.com/images/media/meals/wyxwsp1486979827.jpg',
  strCategory: 'Chicken',
  strArea: 'Indian',
  strInstructions: 'STEP 1\r\nHeat the oil in a pan.\r\n\r\nSTEP 2\r\nAdd the chicken and cook through.',
  strIngredient1: 'Chicken Breast',
  strMeasure1: '500g',
  strIngredient2: 'Onion',
  strMeasure2: '1',
  strIngredient3: 'Olive Oil',
  strMeasure3: '2 tbsp',
  strIngredient4: 'Saffron',
  strMeasure4: 'Pinch',
  strIngredient5: '',
  strMeasure5: ' ',
};

function json(body: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: async () => body } as Response);
}

/** TheMealDB answering search, lookup and categories from the fixture. */
function onlineFetch(url: string) {
  if (url.includes('search.php')) return json({ meals: url.includes('s=chicken') ? [MEAL] : null });
  if (url.includes('lookup.php')) return json({ meals: url.includes('i=52795') ? [MEAL] : null });
  if (url.includes('list.php')) return json({ meals: [{ strCategory: 'Beef' }, { strCategory: 'Chicken' }] });
  if (url.includes('filter.php')) return json({ meals: [{ idMeal: '52795', strMeal: 'Chicken Handi', strMealThumb: null }] });
  return Promise.reject(new Error('unexpected'));
}

let fetchMock: jest.Mock;
beforeEach(async () => {
  mockDb = await migratedDb();
  fetchMock = jest.fn((url: string) => onlineFetch(url));
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('the TheMealDB client', () => {
  test('search, lookup with ingredients and steps, and categories', async () => {
    const api = createMealDb(fetchMock as unknown as typeof fetch);
    expect(await api.searchMeals('chicken')).toEqual({
      status: 'ok',
      meals: [{ id: '52795', name: 'Chicken Handi', thumb: MEAL.strMealThumb }],
    });
    expect(await api.searchMeals('zzz')).toEqual({ status: 'ok', meals: [] });
    const found = await api.getMeal('52795');
    expect(found.status).toBe('ok');
    if (found.status !== 'ok') return;
    expect(found.meal.ingredients).toHaveLength(4);
    expect(found.meal.steps).toEqual(['Heat the oil in a pan.', 'Add the chicken and cook through.']);
    expect(await api.getMeal('1')).toEqual({ status: 'not_found' });
    expect(await api.categories()).toEqual({ status: 'ok', categories: ['Beef', 'Chicken'] });
  });

  test('never throws when offline', async () => {
    const api = createMealDb((() => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch);
    expect(await api.searchMeals('chicken')).toEqual({ status: 'error' });
    expect(await api.getMeal('52795')).toEqual({ status: 'error' });
    expect(await api.categories()).toEqual({ status: 'error' });
  });

  test('numbered steps lose their numbers', () => {
    expect(splitSteps('1. Boil.\n2) Drain.\nStep 3: Serve.')).toEqual(['Boil.', 'Drain.', 'Serve.']);
  });
});

test('search online from Recipes and open a result', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe-book' });
  await fireEvent.changeText(await screen.findByLabelText('Search recipes'), 'chicken');
  await fireEvent.press(screen.getByRole('button', { name: 'Search online' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Chicken Handi' }));
  expect(await screen.findByText('500g Chicken Breast')).toBeTruthy();
  expect(screen.getByText('Heat the oil in a pan.')).toBeTruthy();
  expect(screen.getByLabelText(/^About [\d,]+ kcal and \d+ g protein a portion/)).toBeTruthy();
  expect(screen.getByText(/Not counted: Saffron/)).toBeTruthy();
});

test('pick a category to see its meals', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe-book' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Search online' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Chicken' }));
  expect(await screen.findByRole('button', { name: 'Chicken Handi' })).toBeTruthy();
});

test('offline: says so and the built-in recipes still show', async () => {
  global.fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed'))) as unknown as typeof fetch;
  await renderRouter(appDir, { initialUrl: '/recipe-book' });
  await fireEvent.changeText(await screen.findByLabelText('Search recipes'), 'chicken');
  await fireEvent.press(screen.getByRole('button', { name: 'Search online' }));
  expect(await screen.findByText('Can’t reach TheMealDB right now')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Chicken pesto pasta, / })).toBeTruthy();
});

test('save to my meals: matched ingredients carry over and it opens to edit', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe-book/online/52795' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Save to my meals' }));
  const [saved] = await listRecipes(mockDb, {});
  expect(saved.name).toBe('Chicken Handi');
  expect(saved.portionsMade).toBe(4);
  const recipe = (await getRecipe(mockDb, saved.id))!;
  const names = await Promise.all(
    recipe.ingredients.map(async (i) => (i.kind === 'food' ? `${(await getFood(mockDb, i.foodId))!.name} ${i.amount}` : '')),
  );
  expect(names).toEqual(['Chicken breast, raw 500', 'Onion 110', 'Olive oil 28']);
  expect(await screen.findByText('Edit recipe')).toBeTruthy();
});
