import { renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood } from '@/database/repositories/foodRepository';
import type { Nutrients } from '@/domain/types';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

const food = (name: string, nutrients: Nutrients) =>
  createFood(mockDb, {
    name,
    brand: null,
    barcode: null,
    basis: 'per_serving',
    servingSize: null,
    servingUnit: null,
    nutrients,
    dataSource: 'manual',
    notes: null,
  });

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T12:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('fibre and sugar show under the macros when known', async () => {
  const bar = await food('Cereal bar', { kcal: 200, proteinG: 4, carbsG: 30, fatG: 7, fibreG: 6, sugarG: 12 });
  await logLoggable(mockDb, { kind: 'food', id: bar.id }, 1);
  await renderRouter(appDir, { initialUrl: '/' });
  expect(await screen.findByText('Fibre 6 g · Sugar 12 g')).toBeTruthy();
});

test('a secondary nutrient nobody knows is left out', async () => {
  const rice = await food('Rice pot', { kcal: 200, proteinG: 4, carbsG: 40, fatG: 1, fibreG: 2 });
  await logLoggable(mockDb, { kind: 'food', id: rice.id }, 1);
  await renderRouter(appDir, { initialUrl: '/' });
  expect(await screen.findByText('Fibre 2 g')).toBeTruthy();
  expect(screen.queryByText(/Sugar/)).toBeNull();
});
