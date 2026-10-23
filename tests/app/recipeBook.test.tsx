import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import * as ImagePicker from 'expo-image-picker';
import { useKeepAwake } from 'expo-keep-awake';
import path from 'path';

import type { Db } from '@/database/Db';
import { getRecipePhoto } from '@/database/repositories/recipePhotoRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-23T17:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function open(url: string, header: string) {
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(url));
  await screen.findByRole('header', { name: header });
}

test('a recipe: time, macros per portion, ingredients for the portions, and steps with their ingredients highlighted', async () => {
  await open('/recipe-book/turkey-chilli?portions=4', 'Turkey chilli with rice');
  expect(screen.getByText('10 min prep · 35 min cook')).toBeTruthy();
  expect(screen.getByLabelText(/^Per portion: \d+ kcal, \d+ g protein/)).toBeTruthy();
  // 4 portions of 125 g.
  expect(screen.getByLabelText('Turkey mince 5% fat, raw, 500 g')).toBeTruthy();
  expect(screen.getByText(/^1\. Heat the oil in a large pan/)).toBeTruthy();
  const step2 = screen.getByLabelText('Step 2');
  expect(within(step2).getByLabelText('Uses Turkey mince 5% fat, raw, 500 g')).toBeTruthy();
  expect(screen.getByText(/eat within 1 day/i)).toBeTruthy();
});

test('add your own photo; cancelling changes nothing', async () => {
  await open('/recipe-book/turkey-chilli', 'Turkey chilli with rice');
  await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose from gallery' }));
  expect(await getRecipePhoto(mockDb, 'template:turkey-chilli')).toBeNull();

  jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: 'file:///picked/chilli.jpg', width: 800, height: 600 }],
  } as never);
  await fireEvent.press(screen.getByRole('button', { name: 'Add a photo' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose from gallery' }));
  const saved = await screen.findByLabelText('Turkey chilli with rice, your photo');
  expect(saved.props.source).toEqual([{ uri: expect.stringMatching(/^file:\/\/\/docs\/recipe-photos\//) }]);
  expect(await getRecipePhoto(mockDb, 'template:turkey-chilli')).toMatch(/^file:\/\/\/docs\/recipe-photos\//);
});

test('cook mode: one step at a time, screen kept awake', async () => {
  await open('/recipe-book/turkey-chilli', 'Turkey chilli with rice');
  await fireEvent.press(screen.getByRole('button', { name: 'Cook' }));
  expect(await screen.findByText('Step 1 of 6')).toBeTruthy();
  expect(useKeepAwake).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Next step' }));
  expect(screen.getByText('Step 2 of 6')).toBeTruthy();
  expect(screen.getByText(/brown it, breaking it up/)).toBeTruthy();
});

test('Browse lists the recipe book and filters by meal', async () => {
  await open('/recipe-book', 'Recipes');
  await fireEvent.press(screen.getByRole('button', { name: 'Breakfast' }));
  expect(screen.getByRole('button', { name: /^Protein overnight oats/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Turkey chilli/ })).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search recipes'), 'pancake');
  expect(screen.getByRole('button', { name: /^Banana protein pancakes/ })).toBeTruthy();
});
