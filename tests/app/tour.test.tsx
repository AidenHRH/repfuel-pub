import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { runMigrations } from '@/database/migrate';
import { setSetting } from '@/database/repositories/settingsRepository';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { getTourState } from '@/database/repositories/tourRepository';
import { measureTarget } from '@/features/tour/measure';

import { createTestDb } from '../helpers/testDb';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

const TITLES = [
  'Your day at a glance',
  'Log food',
  'Which meal',
  'Scan it',
  'How much you had',
  'Log it',
  'Log workout',
  'You’re all set',
];

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-23T08:30:00Z'), advanceTimers: true });
  // A fresh install, just through the welcome setup: the tour hasn't been shown.
  mockDb = createTestDb();
  await runMigrations(mockDb);
  await setSetting(mockDb, 'setup', { done: true });
});
afterEach(() => jest.useRealTimers());

const card = () => screen.getByLabelText('Tour');

async function atStop(n: number) {
  expect(await screen.findByText(`${n} of 8`)).toBeTruthy();
  expect(within(card()).getByText(TITLES[n - 1])).toBeTruthy();
}

test('a fresh install walks the 8 stops, ends on Summary, and logs nothing', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  for (let n = 1; n <= 8; n++) {
    await atStop(n);
    await fireEvent.press(within(card()).getByRole('button', { name: n === 8 ? 'Done' : 'Next' }));
  }
  await act(async () => jest.advanceTimersByTime(500));
  expect(screen.queryByLabelText('Tour')).toBeNull();
  expect(screen.getByRole('button', { name: /^Choose a day/ })).toBeTruthy();
  expect(await entriesForDay(mockDb, '2026-10-23')).toEqual([]);
  expect((await getTourState(mockDb)).doneAt).toMatch(/^2026-10-23T08:/);
});

test('the product stops show a banana, and Skip tour closes everything without logging', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  for (let n = 1; n <= 4; n++) {
    await atStop(n);
    await fireEvent.press(within(card()).getByRole('button', { name: 'Next' }));
  }
  await atStop(5);
  expect(screen.getByRole('header', { name: 'Banana' })).toBeTruthy();
  await fireEvent.press(within(card()).getByRole('button', { name: 'Skip tour' }));

  await act(async () => jest.advanceTimersByTime(500));
  expect(screen.queryByLabelText('Tour')).toBeNull();
  expect(screen.queryByRole('header', { name: 'Banana' })).toBeNull();
  expect(screen.getByRole('button', { name: /^Choose a day/ })).toBeTruthy();
  expect(await entriesForDay(mockDb, '2026-10-23')).toEqual([]);
  expect((await getTourState(mockDb)).doneAt).not.toBeNull();
});

test('a stop whose target never appears is skipped after 2 seconds', async () => {
  const real = jest.mocked(measureTarget).getMockImplementation()!;
  jest.mocked(measureTarget).mockImplementation(async (view, id) => (id === 'log-food-meal' ? null : real(view, id)));
  await renderRouter(appDir, { initialUrl: '/' });
  await atStop(1);
  await fireEvent.press(within(card()).getByRole('button', { name: 'Next' }));
  await atStop(2);
  await fireEvent.press(within(card()).getByRole('button', { name: 'Next' }));
  await act(async () => jest.advanceTimersByTime(2100));
  await atStop(4);
  jest.mocked(measureTarget).mockImplementation(real);
});

test('the tour is only marked done when finished or skipped, so a closed app sees it again', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await atStop(1);
  await fireEvent.press(within(card()).getByRole('button', { name: 'Next' }));
  await atStop(2);
  expect((await getTourState(mockDb)).doneAt).toBeNull();
});
