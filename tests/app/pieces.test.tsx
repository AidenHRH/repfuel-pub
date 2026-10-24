import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import { createFood, getFood } from '@/database/repositories/foodRepository';
import type { FoodProduct } from '@/domain/types';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
let tub: FoodProduct;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T19:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  tub = await createFood(mockDb, {
    name: 'Maltesers tub',
    brand: 'Mars',
    barcode: '5000159500005',
    basis: 'per_100g',
    servingSize: null,
    servingUnit: null,
    packSize: 175,
    nutrients: { kcal: 500, proteinG: 8, carbsG: 61, fatG: 24, fibreG: 1 },
    dataSource: 'open_food_facts',
    notes: null,
    shop: 'Tesco',
  });
});
afterEach(() => jest.useRealTimers());

test('asked once how many are in the tub, then logged by the piece', async () => {
  await renderRouter(appDir, { initialUrl: `/food/log?id=${tub.id}` });
  await fireEvent.press(await screen.findByRole('button', { name: 'By the piece' }));
  await fireEvent.changeText(screen.getByLabelText('One is called'), 'Malteser');
  await fireEvent.changeText(screen.getByLabelText('How many in the 175 g pack?'), '35');
  expect(screen.getByText('One is about 5 g')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));

  expect(await screen.findByText('1 Malteser = 5 g')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('How many'), '4');
  await fireEvent.press(screen.getByRole('button', { name: /^Log 20 g · / }));

  const [entry] = await entriesForDay(mockDb, '2026-10-22');
  expect(entry).toMatchObject({ amount: 20, unit: 'g' });
  expect(await getFood(mockDb, tub.id)).toMatchObject({ pieceG: 5, pieceLabel: 'Malteser' });
});

test('a piece weight of 0 or text is refused and nothing is saved', async () => {
  await renderRouter(appDir, { initialUrl: `/food/log?id=${tub.id}` });
  await fireEvent.press(await screen.findByRole('button', { name: 'By the piece' }));
  await fireEvent.press(screen.getByRole('button', { name: 'How much one weighs' }));
  await fireEvent.changeText(screen.getByLabelText('How much does one weigh?'), '0');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Enter a weight above 0')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('How much does one weigh?'), 'lots');
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  expect(screen.getByText('Enter a weight above 0')).toBeTruthy();
  expect((await getFood(mockDb, tub.id))?.pieceG).toBeNull();
});

test('once known, the piece is the first size and By the piece isn’t offered', async () => {
  await mockDb.run('UPDATE food_product SET piece_g = 5, piece_label = ? WHERE id = ?', ['Malteser', tub.id]);
  await renderRouter(appDir, { initialUrl: `/food/log?id=${tub.id}` });
  expect(await screen.findByText('1 Malteser = 5 g')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'By the piece' })).toBeNull();
});
