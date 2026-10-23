import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood } from '@/database/repositories/foodRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-21T12:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('a logged quick meal can be saved as a meal from its entry', async () => {
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
  });
  await logLoggable(mockDb, { kind: 'food', id: katsu.id }, 1);

  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: /^Gousto katsu, 13:30/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Save as a meal' }));
  expect(await screen.findByText('Saved to My meals')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save as a meal' })).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  await screen.findByRole('header', { name: 'Summary' });
  await fireEvent.press(screen.getByRole('button', { name: 'Log food' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Saved meals' }));
  expect(await screen.findByRole('button', { name: 'Log 1 portion of Gousto katsu' })).toBeTruthy();
});
