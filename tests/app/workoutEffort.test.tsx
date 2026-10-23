import { renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { listExercises } from '@/database/repositories/exerciseRepository';
import { logLift } from '@/database/repositories/liftRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T19:00:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

test('the history shows each lift’s effort, the day’s average, and a nudge when it felt easy', async () => {
  const bench = (await listExercises(mockDb, { search: 'barbell bench press' }))[0].id;
  const fly = (await listExercises(mockDb, { search: 'cable fly' }))[0].id;
  await logLift(mockDb, {
    exerciseId: bench,
    at: new Date('2026-10-22T17:00:00Z'),
    sets: [
      { weightKg: 80, reps: 8, effort: 7 },
      { weightKg: 80, reps: 8, effort: 8 },
      { weightKg: 80, reps: 7, effort: 9 },
    ],
  });
  await logLift(mockDb, {
    exerciseId: fly,
    at: new Date('2026-10-22T17:30:00Z'),
    sets: [
      { weightKg: 15, reps: 12, effort: 5 },
      { weightKg: 15, reps: 12, effort: 6 },
    ],
  });
  await renderRouter(appDir, { initialUrl: '/workouts' });
  expect(await screen.findByRole('button', { name: /^Edit Barbell bench press, .*effort 7 → 9/ })).toBeTruthy();
  expect(screen.getByText('effort 7 → 9')).toBeTruthy();
  expect(screen.getByText('Felt easy: try a bit more next time')).toBeTruthy();
  expect(screen.getByLabelText('Average effort 7 out of 10')).toBeTruthy();
});
