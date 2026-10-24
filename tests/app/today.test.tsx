import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { createFood } from '@/database/repositories/foodRepository';
import { setRecipeFavourite } from '@/database/repositories/recipeRepository';
import { logClass } from '@/database/repositories/classRepository';
import { getPlan, makePlan, planDayKeys } from '@/database/repositories/mealPlanRepository';

import { finishBasket } from '../helpers/basket';
import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

async function openToday() {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Summary' });
}

/** Saved meals are two taps away: Log food, then Saved meals. */
async function logFromLogFood(label: string) {
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));
  await fireEvent.press(await screen.findByRole('button', { name: label }));
  await finishBasket();
}

const ring = (kcal: string, protein: string) => `Calories ${kcal} of 2,500. Protein ${protein} of 145 grams.`;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-21T07:30:00Z'), advanceTimers: true }); // 08:30 in London
  mockDb = await migratedDb();
  const { overnightOats } = await seedRegulars(mockDb);
  await setRecipeFavourite(mockDb, overnightOats.id, true);
});

afterEach(() => jest.useRealTimers());

test('starts from real, empty totals with your saved meals ready', async () => {
  await openToday();
  expect(await screen.findByLabelText(ring('0', '0'))).toBeTruthy();
  expect(screen.getByText('2,500 kcal left')).toBeTruthy();
  expect(screen.getByText('Nothing logged yet today')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));
  expect(await screen.findByRole('button', { name: 'Log 1 portion of Overnight oats' })).toBeTruthy();
});

test('one tap logs a saved meal, updates totals and offers Undo', async () => {
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');

  expect(await screen.findByLabelText(ring('404', '37'))).toBeTruthy();
  expect(screen.getByText('Logged Overnight oats')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Breakfast' })).toBeTruthy();
  expect(screen.getByText('404 kcal · 37 g')).toBeTruthy();
  expect(screen.getByText('08:30')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  expect(await screen.findByLabelText(ring('0', '0'))).toBeTruthy();
  expect(screen.getByText('Nothing logged yet today')).toBeTruthy();
});

test('Adjust changes the portion of what was just logged', async () => {
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');
  await fireEvent.press(await screen.findByRole('button', { name: 'Adjust' }));

  await screen.findByRole('header', { name: 'Overnight oats' });
  await fireEvent.press(screen.getByRole('button', { name: '2' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(await screen.findByLabelText(ring('807', '75'))).toBeTruthy();
});

test('Adjust offers quarters, e.g. half a portion', async () => {
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');
  await fireEvent.press(await screen.findByRole('button', { name: 'Adjust' }));
  await screen.findByRole('header', { name: 'Overnight oats' });
  expect(screen.getByRole('button', { name: '¼' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '½' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));

  expect(await screen.findByLabelText('Calories 202 of 2,500. Protein 19 of 145 grams.')).toBeTruthy();
});

test('Undo only ever removes the entry it was offered for', async () => {
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');
  await act(async () => jest.advanceTimersByTime(5000));
  expect(screen.queryByText('Logged Overnight oats')).toBeNull();

  await logFromLogFood('Log 1 portion of Overnight oats');
  await fireEvent.press(await screen.findByRole('button', { name: 'Undo' }));

  expect(await screen.findByLabelText(ring('404', '37'))).toBeTruthy();
});

test('an approximate meal marks the totals with ≈', async () => {
  const katsu = await createFood(mockDb, {
    name: 'Gousto katsu',
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients: { kcal: 650, proteinG: 40, carbsG: null, fatG: null, fibreG: null },
    dataSource: 'user_approximate',
    notes: null,
    isFavourite: true,
  });
  await openToday();
  // A starred food is a Favourites tile on Log food.
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: `Log 1 serving of ${katsu.name}` }));
  await finishBasket();
  expect(await screen.findByText('≈ 650')).toBeTruthy();
  expect(screen.getByText(/includes your estimates/)).toBeTruthy();
});

test('just after midnight Today starts a fresh day', async () => {
  jest.setSystemTime(new Date('2026-10-21T22:58:00Z')); // 23:58 BST
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');
  expect(await screen.findByLabelText(ring('404', '37'))).toBeTruthy();

  await act(async () => jest.advanceTimersByTime(3 * 60 * 1000));
  await waitFor(() => expect(screen.getByLabelText(ring('0', '0'))).toBeTruthy());
});

test('a food row can be deleted (with Undo) or edited from its swipe actions', async () => {
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');
  await act(async () => jest.advanceTimersByTime(5000));

  const row = await screen.findByRole('button', { name: /^Overnight oats, 08:30/ });
  expect(row.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
    'activate',
    'edit',
    'delete',
    'longpress',
  ]);
  await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
  expect(await screen.findByText('Deleted Overnight oats')).toBeTruthy();
  expect(await screen.findByLabelText(ring('0', '0'))).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  const restored = await screen.findByRole('button', { name: /^Overnight oats, 08:30/ });
  await fireEvent(restored, 'accessibilityAction', { nativeEvent: { actionName: 'edit' } });
  expect(await screen.findByRole('header', { name: 'Overnight oats' })).toBeTruthy();
});

test('swiping a row shows Edit and Delete buttons', async () => {
  await openToday();
  await logFromLogFood('Log 1 portion of Overnight oats');
  await act(async () => jest.advanceTimersByTime(5000));
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete Overnight oats' }));
  expect(await screen.findByText('Deleted Overnight oats')).toBeTruthy();
});

describe('Summary', () => {
  test('Daily habits lists the day’s sessions, each opening to its detail', async () => {
    await logClass(mockDb, {
      classTypeId: 'class_hyrox',
      at: new Date('2026-10-21T06:30:00Z'),
      durationMin: 60,
      effort: 9,
      notes: null,
    });
    await openToday();
    expect(await screen.findByRole('header', { name: 'Daily habits' })).toBeTruthy();
    await fireEvent.press(await screen.findByRole('button', { name: /^07:30 · Hyrox, 60 min, effort 9/ }));
    expect(await screen.findByRole('header', { name: 'Edit class' })).toBeTruthy();
  });

  test('the meal planned for now can be logged in one tap', async () => {
    await makePlan(mockDb, { from: new Date(), seed: 1 });
    const [today] = await getPlan(mockDb, planDayKeys(new Date(), 1));
    const breakfast = today.meals.find((m) => m.slot === 'breakfast')!;
    await openToday();
    await fireEvent.press(await screen.findByRole('button', { name: `Log planned breakfast, ${breakfast.name}` }));
    expect(await screen.findByText(`Logged ${breakfast.name}`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: `Log planned breakfast, ${breakfast.name}` })).toBeNull();
  });
});
