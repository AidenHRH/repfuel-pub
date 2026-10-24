import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { getPlan, makePlan, planDayKeys } from '@/database/repositories/mealPlanRepository';
import { updateReminder } from '@/database/repositories/reminderRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openSummary() {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('button', { name: /^Choose a day/ });
}

test('each meal is a card: its totals and photo tiles, Log; Drinks on their own', async () => {
  const { overnightOats } = await seedRegulars(mockDb);
  await logLoggable(mockDb, { kind: 'recipe', id: overnightOats.id }, 1, new Date(2026, 9, 22, 8), 'breakfast');
  await openSummary();
  expect(await screen.findByText('· 404 kcal · 37 g protein')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Overnight oats, 08:00/ })).toBeTruthy();
  expect(screen.getByText('· on their own')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log breakfast' })).toBeTruthy();
});

test('View diary lists every item with its swipe actions; Hide diary goes back to the photos', async () => {
  const { overnightOats } = await seedRegulars(mockDb);
  await logLoggable(mockDb, { kind: 'recipe', id: overnightOats.id }, 1, new Date(2026, 9, 22, 8), 'breakfast');
  await openSummary();
  expect(screen.queryByRole('button', { name: 'Delete Overnight oats' })).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'View diary' }));
  expect(screen.getByRole('button', { name: 'Delete Overnight oats' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Hide diary' }));
  expect(screen.queryByRole('button', { name: 'Delete Overnight oats' })).toBeNull();
});

test('a planned dish shows on its meal, and its Log logs it in one tap', async () => {
  await seedRegulars(mockDb);
  await makePlan(mockDb, { from: new Date(), seed: 1 });
  const [today] = await getPlan(mockDb, planDayKeys(new Date(), 1));
  const dinner = today.meals.find((m) => m.slot === 'dinner')!;
  await openSummary();
  expect(await screen.findByText(`· planned: ${dinner.name}`)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: `Log planned dinner, ${dinner.name}` }));
  expect(await screen.findByText(`Logged ${dinner.name}`)).toBeTruthy();
  // Something else for dinner: the card itself opens Log food.
  expect(screen.queryByRole('button', { name: `Log planned dinner, ${dinner.name}` })).toBeNull();
});

test('Daily habits: creatine with what Taken adds, and Log workout', async () => {
  await updateReminder(mockDb, 'creatine', { enabled: true });
  await openSummary();
  const habits = await screen.findByRole('header', { name: 'Daily habits' });
  expect(habits).toBeTruthy();
  const taken = await screen.findByRole('button', { name: 'Mark creatine taken' });
  expect(within(taken).getByText(/^\+ \d+(\.\d+)? g$/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log workout' })).toBeTruthy();
});

test('the + button opens Log food', async () => {
  await openSummary();
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  expect(await screen.findByRole('header', { name: 'Log food' })).toBeTruthy();
});
