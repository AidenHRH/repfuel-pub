import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';
import { Alert } from 'react-native';

import type { Db } from '@/database/Db';
import * as foodLog from '@/database/repositories/foodLogRepository';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
let seeded: Awaited<ReturnType<typeof seedRegulars>>;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-21T11:00:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  seeded = await seedRegulars(mockDb);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('if logging fails, Saved meals says so and stays open instead of pretending it worked', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  jest.spyOn(foodLog, 'logLoggable').mockRejectedValueOnce(new Error('disk full'));
  await renderRouter(appDir, { initialUrl: '/saved-meals' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log 1 portion of Overnight oats' }));

  expect(alert).toHaveBeenCalledWith('Couldn’t log Overnight oats', expect.any(String));
  expect(screen.getByRole('header', { name: 'Saved meals' })).toBeTruthy();
});

test('tapping Undo twice after deleting an entry restores it once, without an error', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const entry = await logLoggable(mockDb, { kind: 'recipe', id: seeded.overnightOats.id }, 1);
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('button', { name: /^Choose a day/ });
  // The entry's photo tile on its meal's card.
  await fireEvent.press(await screen.findByRole('button', { name: new RegExp(`^${entry.name}, `) }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete entry' }));
  const undo = await screen.findByRole('button', { name: 'Undo' });

  await act(async () => {
    fireEvent.press(undo);
    fireEvent.press(undo);
  });

  expect(await entriesForDay(mockDb, '2026-10-21')).toHaveLength(1);
  expect(alert).not.toHaveBeenCalled();
});
