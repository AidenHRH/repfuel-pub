import { fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { listExercises } from '@/database/repositories/exerciseRepository';
import { logLift } from '@/database/repositories/liftRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

let bench: string;

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:00:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  bench = (await listExercises(mockDb, { search: 'barbell bench press' }))[0].id;
  const squat = (await listExercises(mockDb, { search: 'back squat' }))[0].id;
  // Bench: 80 kg × 8 getting easier over five weeks, then 85 kg.
  const weeks: [string, number, number][] = [
    ['2026-09-15', 80, 9],
    ['2026-09-22', 80, 9],
    ['2026-09-29', 80, 8],
    ['2026-10-06', 80, 7],
    ['2026-10-13', 80, 7],
    ['2026-10-20', 85, 8],
  ];
  for (const [day, kg, effort] of weeks) {
    await logLift(mockDb, {
      exerciseId: bench,
      at: new Date(`${day}T18:00:00Z`),
      sets: [
        { weightKg: kg, reps: 8, effort },
        { weightKg: kg, reps: 8, effort: Math.min(10, effort + 1) },
      ],
    });
  }
  await logLift(mockDb, {
    exerciseId: squat,
    at: new Date('2026-10-14T18:00:00Z'),
    sets: [{ weightKg: 100, reps: 5, effort: 8 }],
  });
});
afterEach(() => jest.useRealTimers());

test('the overview shows the headline numbers and charts, each saying what it shows', async () => {
  await renderRouter(appDir, { initialUrl: '/progress' });
  expect(await screen.findByLabelText(/^Workouts: 7/)).toBeTruthy();
  expect(screen.getByLabelText(/^New PRs: 1/)).toBeTruthy();
  expect(screen.getByLabelText(/^Weekly average effort over 12 weeks: from 9\.5 to 8\.5/)).toBeTruthy();
  expect(screen.getByText(/How hard your sets and classes felt, 1–10/)).toBeTruthy();
  expect(screen.getByText(/Weight × reps, added up each week/)).toBeTruthy();
  expect(screen.getByLabelText(/^Chest, /)).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Barbell bench press, 1RM est\. 108 kg/ })).toBeTruthy();
});

test('search a muscle and see its workouts, current PRs and lifts', async () => {
  await renderRouter(appDir, { initialUrl: '/progress' });
  await fireEvent.changeText(await screen.findByLabelText('Search a lift or muscle'), 'che');
  await fireEvent.press(await screen.findByRole('button', { name: 'Chest progress' }));
  expect(await screen.findByText('Current PRs')).toBeTruthy();
  expect(screen.getByText('85 kg × 8')).toBeTruthy();
  expect(screen.getByLabelText(/^Tue 20 Oct: Barbell bench press, effort 8\.5, 1 PR/)).toBeTruthy();
  expect(screen.getByLabelText(/^Chest strength over 12 weeks: up/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Barbell bench press, 1RM est/ }));
  expect(await screen.findByText('Sessions')).toBeTruthy();
});

test('a lift: 1RM chart, same weight getting easier, and each session’s effort', async () => {
  await renderRouter(appDir, { initialUrl: `/lift-progress/${bench}` });
  expect(await screen.findByLabelText(/^1RM over the last 6 sessions: from 101\.3 to 107\.7 kg/)).toBeTruthy();
  expect(screen.getByText('Same weight, getting easier?')).toBeTruthy();
  expect(screen.getByLabelText('Effort on 80 kg for 8: from 9.5 to 7.5')).toBeTruthy();
  const latest = within(screen.getByLabelText(/^Tue 20 Oct: 85 kg × 8, 8/));
  expect(latest.getByText('PR')).toBeTruthy();
  expect(screen.getAllByLabelText('Effort by set: 8, 9').length).toBeGreaterThan(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Effort' }));
  expect(await screen.findByLabelText(/^Effort over the last 6 sessions: from 9\.5 to 8\.5/)).toBeTruthy();
});

test('search a lift by name', async () => {
  await renderRouter(appDir, { initialUrl: '/progress' });
  await fireEvent.changeText(await screen.findByLabelText('Search a lift or muscle'), 'squat');
  expect(await screen.findByRole('button', { name: /^Back squat, 1RM est\. 117 kg/ })).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Search a lift or muscle'), 'zzz');
  expect(await screen.findByText('Nothing you’ve logged matches that.')).toBeTruthy();
});
