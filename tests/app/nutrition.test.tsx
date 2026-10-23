import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';
import { Alert } from 'react-native';

import type { Db } from '@/database/Db';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
let ids: Awaited<ReturnType<typeof seedRegulars>>;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-21T11:00:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  ids = await seedRegulars(mockDb);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function openNutrition(tab: 'Meals' | 'Foods') {
  await renderRouter(appDir, { initialUrl: '/nutrition' });
  await screen.findByRole('header', { name: 'Nutrition' });
  await fireEvent.press(screen.getByRole('button', { name: tab }));
}

test('meals and foods are listed with their nutrition', async () => {
  await openNutrition('Meals');
  expect(await screen.findByText('Beef & sweet potato')).toBeTruthy();
  expect(screen.getByText('451 kcal · 37 g protein per portion')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Foods' }));
  expect(await screen.findByText('whey')).toBeTruthy();
});

test('starring a food makes it one tap in Log food', async () => {
  await openNutrition('Foods');
  await fireEvent.press(await screen.findByRole('button', { name: 'Star whey' }));
  expect(await screen.findByRole('button', { name: 'Unstar whey' })).toBeTruthy();

  await fireEvent.press(screen.getByLabelText(/^Summary, tab/));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  expect(await screen.findByRole('button', { name: 'Log 1 serving of whey' })).toBeTruthy();
});

test('deleting a food asks first, removes it from the list and keeps past entries', async () => {
  await logLoggable(mockDb, { kind: 'food', id: ids.foods.whey.id }, 1);
  const alert = jest.spyOn(Alert, 'alert');
  await openNutrition('Foods');

  await fireEvent(await screen.findByRole('button', { name: 'Edit whey' }), 'longPress');
  expect(alert).toHaveBeenCalledWith('Delete whey?', expect.stringContaining('Past entries'), expect.any(Array));
  const buttons = alert.mock.calls[0][2]!;
  await buttons.find((b) => b.text === 'Delete')!.onPress!();

  await waitFor(() => expect(screen.queryByText('whey')).toBeNull());
  expect(await entriesForDay(mockDb, '2026-10-21')).toHaveLength(1);
});

test('an empty search says so', async () => {
  await openNutrition('Meals');
  await fireEvent.changeText(screen.getByLabelText('Search'), 'lasagne');
  expect(await screen.findByText('No meals match “lasagne”')).toBeTruthy();
});
