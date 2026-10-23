import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logClass } from '@/database/repositories/classRepository';
import { logLift } from '@/database/repositories/liftRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T18:30:00Z'), advanceTimers: true }); // Thursday evening
  mockDb = await migratedDb();
  await logLift(mockDb, {
    exerciseId: 'ex_barbell_bench_press',
    at: new Date('2026-10-15T17:00:00Z'),
    sets: [{ weightKg: 87.5, reps: 2, effort: 8 }],
  });
  await logLift(mockDb, {
    exerciseId: 'ex_ab_wheel_rollout',
    at: new Date('2026-10-19T17:00:00Z'),
    sets: [
      { weightKg: null, reps: 15, effort: null },
      { weightKg: null, reps: 12, effort: null },
    ],
  });
  await logLift(mockDb, {
    exerciseId: 'ex_plank',
    at: new Date('2026-10-19T17:20:00Z'),
    sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: 90 }],
  });
  await logClass(mockDb, {
    classTypeId: 'class_hyrox',
    at: new Date('2026-10-20T17:30:00Z'),
    durationMin: 60,
    effort: 9,
    notes: 'Wall balls killed me',
  });
  await logLift(mockDb, {
    exerciseId: 'ex_barbell_bench_press',
    at: new Date('2026-10-22T17:05:00Z'),
    sets: [{ weightKg: 90, reps: 1, effort: 8 }],
  });
});
afterEach(() => jest.useRealTimers());

test('the week at a glance: sessions, class time and PRs', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  const week = within(await screen.findByLabelText('This week'));
  expect(week.getByLabelText('3 sessions')).toBeTruthy();
  expect(week.getByLabelText('60 min of classes')).toBeTruthy();
  expect(week.getByLabelText('1 PR')).toBeTruthy();
});

test('each day lists lifts, timed holds and classes', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  expect(await screen.findByRole('header', { name: 'Today' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Tuesday' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Monday' })).toBeTruthy();
  expect(screen.getByText('90 kg × 1 @ 8')).toBeTruthy();
  expect(screen.getByLabelText('Personal record')).toBeTruthy();
  expect(screen.getByText('15, 12 reps')).toBeTruthy();
  expect(screen.getByText('1:30')).toBeTruthy();
  expect(screen.getByText('9/10 · Very, very hard')).toBeTruthy();
  expect(screen.getByText('“Wall balls killed me”')).toBeTruthy();
});

test('tapping a class opens it to edit', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await fireEvent.press(await screen.findByRole('button', { name: /^Edit Hyrox/ }));
  expect(await screen.findByRole('header', { name: 'Edit class' })).toBeTruthy();
});
