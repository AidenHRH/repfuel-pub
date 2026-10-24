import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';
import { Alert } from 'react-native';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { quickAdd } from '@/database/repositories/snackRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London, lunchtime
  mockDb = await migratedDb();
  const earlier = new Date('2026-10-01T09:00:00Z');
  await quickAdd(mockDb, {
    name: 'Meal deal sandwich',
    kcal: 420,
    proteinG: 24,
    mealCategory: 'snack',
    keepAsTile: true,
    at: earlier,
  });
  await quickAdd(mockDb, { name: 'Coke can', kcal: 139, proteinG: 0, mealCategory: 'drink', keepAsTile: true, at: earlier });
  await mockDb.run('DELETE FROM food_log_entry');
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function openLunch() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log lunch' }));
  await screen.findByRole('header', { name: 'Log food' });
}

test('Log food guesses the meal from the time, and the pills change it', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  expect((await screen.findByRole('button', { name: 'Lunch' })).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'Dinner' }));
  expect(screen.getByRole('button', { name: 'Dinner' }).props.accessibilityState.selected).toBe(true);
});

test('a sandwich and a can go in one basket, then Log 2 items logs the lunch', async () => {
  await openLunch();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Meal deal sandwich' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Coke can' }));

  expect(await screen.findByRole('header', { name: 'Your lunch · 2 items' })).toBeTruthy();
  expect(screen.getByText('≈ 559 kcal · 24 g protein · 1,941 kcal left today')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Log 2 items' }));

  expect(await screen.findByText('Logged 2 items')).toBeTruthy();
  const lunch = await entriesForDay(mockDb, '2026-10-22');
  expect(lunch.map((e) => [e.name, e.mealCategory])).toEqual([
    ['Meal deal sandwich', 'lunch'],
    ['Coke can', 'lunch'],
  ]);
  await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
  await act(async () => undefined);
  expect(await entriesForDay(mockDb, '2026-10-22')).toEqual([]);
});

test('taking an item out of the basket removes it from the diary', async () => {
  await openLunch();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Meal deal sandwich' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Coke can' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Remove Coke can' }));
  expect(await screen.findByRole('header', { name: 'Your lunch · 1 item' })).toBeTruthy();
  expect((await entriesForDay(mockDb, '2026-10-22')).map((e) => e.name)).toEqual(['Meal deal sandwich']);
});

test('closing with items asks whether to keep them', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await openLunch();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Meal deal sandwich' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Coke can' }));
  await screen.findByRole('header', { name: 'Your lunch · 2 items' });
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(alert).toHaveBeenCalledWith('Keep 2 items?', expect.any(String), expect.any(Array));
  const buttons = alert.mock.calls[0][2]!;
  await act(async () => {
    await buttons.find((b) => b.text === 'Remove')!.onPress!();
  });
  expect(await entriesForDay(mockDb, '2026-10-22')).toEqual([]);
  expect(await screen.findByRole('header', { name: 'Summary' })).toBeTruthy();
});

test('Keep leaves them logged', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await openLunch();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Meal deal sandwich' }));
  await screen.findByRole('header', { name: 'Your lunch · 1 item' });
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await act(async () => {
    alert.mock.calls[0][2]!.find((b) => b.text === 'Keep')!.onPress!();
  });
  expect(await screen.findByText('Logged Meal deal sandwich')).toBeTruthy();
  expect(await entriesForDay(mockDb, '2026-10-22')).toHaveLength(1);
});

test('opened from a past day, the basket logs to that day and returns to it', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: /^Yesterday, / }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log dinner' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Meal deal sandwich' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 item' }));
  expect(await screen.findByRole('button', { name: 'Choose a day, showing Yesterday' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: /^Meal deal sandwich, 18:30/ })).toBeTruthy();
  expect(await entriesForDay(mockDb, '2026-10-21')).toHaveLength(1);
});

test('+ Add a drink opens the scanner for the same meal; + Add a snack opens search for a snack', async () => {
  await openLunch();
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 serving of Meal deal sandwich' }));
  await fireEvent.press(await screen.findByRole('button', { name: '+ Add a drink' }));
  expect(await screen.findByRole('header', { name: 'Scan barcode' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  await fireEvent.press(await screen.findByRole('button', { name: '+ Add a snack' }));
  expect(await screen.findByRole('header', { name: 'Search food' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Snack' }).props.accessibilityState.selected).toBe(true);
});
