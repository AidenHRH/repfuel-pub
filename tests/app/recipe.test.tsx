import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { deleteRecipe, listRecipes } from '@/database/repositories/recipeRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

let seeded: Awaited<ReturnType<typeof seedRegulars>>;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-21T17:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  seeded = await seedRegulars(mockDb);
});
afterEach(() => jest.useRealTimers());

async function addFood(name: string, amount: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
  await fireEvent.press(await screen.findByRole('button', { name: `Choose ${name}` }));
  // Weighed foods take an amount; foods counted in servings take How many.
  await screen.findByRole('button', { name: 'Add' });
  const field = screen.queryByLabelText('Amount') ?? screen.getByLabelText('How many');
  await fireEvent.changeText(field, amount);
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));
}

test('build a meal with half a portion of the pico batch, save once, starred for one-tap logging', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe/new' });
  await screen.findByRole('header', { name: 'New recipe' });

  await fireEvent.changeText(screen.getByLabelText('Name'), 'Beef bowl');
  await addFood('sweet-potato', '250');
  await addFood('beef', '150');

  await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose Pico salad' }));
  await fireEvent.press(await screen.findByRole('button', { name: '½' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Add' }));

  const perPortion = within(screen.getByLabelText('Per portion'));
  expect(perPortion.getByText('436 kcal')).toBeTruthy();
  expect(perPortion.getByText('37 g protein')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect((await listRecipes(mockDb, { search: 'Beef bowl' }))[0]).toMatchObject({ isFavourite: true, portionsMade: 1 });
});

test('saving is disabled until the recipe has a name and an ingredient', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe/new' });
  await screen.findByRole('header', { name: 'New recipe' });
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Empty');
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('a batch split into more portions shows less per portion', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe/new' });
  await screen.findByRole('header', { name: 'New recipe' });
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Big pico');
  await addFood('pico-mix', '2');
  expect(within(screen.getByLabelText('Per portion')).getByText('240 kcal')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));
  await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));
  await fireEvent.press(screen.getByRole('button', { name: 'More portions' }));
  expect(screen.getByText('Makes 4 portions')).toBeTruthy();
  expect(within(screen.getByLabelText('Per portion')).getByText('60 kcal')).toBeTruthy();
});

test('the ingredient picker can be searched', async () => {
  await renderRouter(appDir, { initialUrl: '/recipe/new' });
  await screen.findByRole('header', { name: 'New recipe' });
  await fireEvent.press(screen.getByRole('button', { name: 'Add ingredient' }));
  await fireEvent.changeText(await screen.findByLabelText('Search ingredients'), 'pico');
  expect(screen.getByRole('button', { name: 'Choose Pico salad' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Choose sweet-potato' })).toBeNull();
});

test('a meal still shows its nutrition after the batch it uses was deleted', async () => {
  await deleteRecipe(mockDb, seeded.pico.id);
  await renderRouter(appDir, { initialUrl: `/recipe/${seeded.beefDinner.id}` });
  await screen.findByRole('header', { name: 'Edit recipe' });
  expect(await screen.findByText('Pico salad')).toBeTruthy();
  expect(within(screen.getByLabelText('Per portion')).getByText('451 kcal')).toBeTruthy();
});
