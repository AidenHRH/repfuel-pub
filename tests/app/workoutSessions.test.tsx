import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import path from 'path';
import { Alert } from 'react-native';

import type { Db } from '@/database/Db';
import { logLift } from '@/database/repositories/liftRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
const set = [{ weightKg: 40, reps: 8, effort: 7 }];

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T18:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  await logLift(mockDb, { exerciseId: 'ex_overhead_press', at: new Date('2026-10-22T11:20:00Z'), sets: set });
  await logLift(mockDb, { exerciseId: 'ex_barbell_bench_press', at: new Date('2026-10-22T17:05:00Z'), sets: set });
  await logLift(mockDb, { exerciseId: 'ex_cable_triceps_pushdown', at: new Date('2026-10-22T17:30:00Z'), sets: set });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('two gym visits in a day show as two named sessions, each opening its sets', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  expect(await screen.findByRole('button', { name: /^12:20 session: Shoulders, 1 exercise/ })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^18:05 session: Chest & triceps, 2 exercises/ }));
  expect(await screen.findByRole('header', { name: 'Chest & triceps' })).toBeTruthy();
});

test('holding a lift can start a new session from it', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await fireEvent(await screen.findByRole('button', { name: /^Edit Cable triceps pushdown/i }), 'longPress');
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons.map((b) => b.text)).toEqual(['Start new session', 'Delete', 'Cancel']);
  await buttons[0].onPress!();
  expect(await screen.findByRole('button', { name: /^18:30 session: Triceps/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^18:05 session: Chest, 1 exercise/ })).toBeTruthy();
});
