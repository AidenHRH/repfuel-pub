import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { lineForDay } from '@/domain/motivation';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T07:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('Today shows the day’s line, and Settings can hide it', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  expect(await screen.findByText(lineForDay('2026-10-22'))).toBeTruthy();

  await fireEvent.press(screen.getByLabelText(/^Settings, tab/));
  await fireEvent(await screen.findByLabelText('Daily motivation'), 'valueChange', false);
  await fireEvent.press(screen.getByLabelText(/^Summary, tab/));
  await screen.findByRole('header', { name: 'Summary' });
  expect(screen.queryByText(lineForDay('2026-10-22'))).toBeNull();
});
