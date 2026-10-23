import * as Haptics from 'expo-haptics';
import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logLift, recentLifts } from '@/database/repositories/liftRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
const BENCH = 'ex_barbell_bench_press';

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T17:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function startLift(search: string, name: string) {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
  await screen.findByRole('header', { name: 'Log workout' });
  await fireEvent.changeText(screen.getByLabelText('Search exercises'), search);
  await fireEvent.press(await screen.findByRole('button', { name: `Choose ${name}` }));
}

test('log a lift in a few taps and see it under recent lifts', async () => {
  await startLift('bench', 'Barbell bench press');
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '80');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '8');
  await fireEvent.press(screen.getByRole('button', { name: 'Set 1 effort 7' }));
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));

  await screen.findByRole('header', { name: 'Workouts' });
  expect(await screen.findByText('Barbell bench press')).toBeTruthy();
  expect(screen.getByText('80 kg × 8 @ 7')).toBeTruthy();
});

test('shows last time and copies the previous set', async () => {
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-20T18:00:00Z'),
    sets: [{ weightKg: 80, reps: 8, effort: 8 }],
  });
  await startLift('bench', 'Barbell bench press');
  expect(screen.getByText(/Last time: 80 kg × 8 @ 8/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '82.5');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '6');
  await fireEvent.press(screen.getByRole('button', { name: 'Add set' }));
  expect(screen.getByLabelText('Weight for set 2').props.value).toBe('82.5');
  expect(screen.getByLabelText('Reps for set 2').props.value).toBe('6');
});

test('a heavier lift is celebrated as a PR', async () => {
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-20T18:00:00Z'),
    sets: [{ weightKg: 80, reps: 8, effort: null }],
  });
  await startLift('bench', 'Barbell bench press');
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '85');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '5');
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));

  expect(await screen.findByText('New PR')).toBeTruthy();
  expect(screen.getByText('Heaviest ever: 85 kg (was 80 kg)')).toBeTruthy();
});

test('Progress lists records, labels the estimate, and follows edits', async () => {
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-20T18:00:00Z'),
    sets: [{ weightKg: 80, reps: 8, effort: null }],
  });
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-22T08:00:00Z'),
    sets: [{ weightKg: 85, reps: 5, effort: null }],
  });
  await renderRouter(appDir, { initialUrl: '/progress' });
  const card = within(await screen.findByLabelText('Records for Barbell bench press'));
  expect(card.getByText('85 kg × 5')).toBeTruthy();
  expect(card.getByText(/estimate/)).toBeTruthy();

  await fireEvent.press(screen.getByLabelText(/^Workouts, tab/));
  await fireEvent.press(await screen.findByRole('button', { name: /^Edit Barbell bench press, today/ }));
  await fireEvent.changeText(await screen.findByLabelText('Weight for set 1'), '75');
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));
  await screen.findByRole('header', { name: 'Workouts' });

  await fireEvent.press(screen.getByLabelText(/^Progress, tab/));
  expect(await within(await screen.findByLabelText('Records for Barbell bench press')).findByText('80 kg × 8')).toBeTruthy();
});

test('Save waits until every set has reps', async () => {
  await startLift('cable fly', 'Cable fly');
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '15');
  expect(screen.getByRole('button', { name: /^Save / })).toBeDisabled();
});

test('a bodyweight set leaves weight blank', async () => {
  await startLift('push-up', 'Push-up');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '20');
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));
  await screen.findByRole('header', { name: 'Workouts' });
  expect(await screen.findByText('20 reps')).toBeTruthy();
});

test('an exercise not in the library can be added from the search', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'Landmine press');
  await fireEvent.press(await screen.findByRole('button', { name: 'Add Landmine press as an exercise' }));
  expect(await screen.findByLabelText('Weight for set 1')).toBeTruthy();
  expect(screen.getByText('Landmine press')).toBeTruthy();
});

test('Today has its own Log workout button, and confirms the PR there', async () => {
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-20T18:00:00Z'),
    sets: [{ weightKg: 80, reps: 8, effort: null }],
  });
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'bench');
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose Barbell bench press' }));
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '85');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '5');
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));

  await screen.findByRole('header', { name: 'Summary' });
  expect(await screen.findByText('New PR · Heaviest ever: 85 kg (was 80 kg)')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'View' }));
  expect(await screen.findByRole('header', { name: 'Workouts' })).toBeTruthy();
});

test('editing a lift never shows the exercise picker', async () => {
  const { workoutId } = await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-22T08:00:00Z'),
    sets: [{ weightKg: 80, reps: 8, effort: null }],
  });
  await renderRouter(appDir, { initialUrl: `/lift/${workoutId}` });
  expect(screen.queryByLabelText('Search exercises')).toBeNull();
  expect(await screen.findByLabelText('Weight for set 1')).toBeTruthy();
});

test('a lift logged from Workouts is not announced again on Today', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Summary' });
  await fireEvent.press(screen.getByLabelText(/^Workouts, tab/));
  await screen.findByRole('header', { name: 'Workouts' });
  await fireEvent.press(screen.getAllByRole('button', { name: 'Log workout' }).at(-1)!);
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'bench');
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose Barbell bench press' }));
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '60');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '10');
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));
  expect(await screen.findByText('Saved Barbell bench press')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText(/^Summary, tab/));
  await screen.findByRole('header', { name: 'Summary' });
  expect(screen.queryByText('Saved Barbell bench press')).toBeNull();
});

test('a lift deleted elsewhere closes its editor instead of showing a blank screen', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await screen.findByRole('header', { name: 'Workouts' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push('/lift/does-not-exist'));
  expect(await screen.findByRole('header', { name: 'Workouts' })).toBeTruthy();
  expect(screen.queryByRole('header', { name: 'Edit lift' })).toBeNull();
});

test('reps-only exercises ask for reps, with weight optional', async () => {
  await startLift('ab wheel', 'Ab wheel rollout');
  expect(screen.queryByLabelText('Weight for set 1')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '15');
  await fireEvent.press(screen.getByRole('button', { name: 'Save Ab wheel rollout' }));
  await screen.findByRole('header', { name: 'Workouts' });
  const lift = (await recentLifts(mockDb))[0];
  expect(lift.sets).toEqual([{ weightKg: null, reps: 15, effort: null }]);
});

test('a reps-only exercise can still take added weight', async () => {
  await startLift('push-up', 'Push-up');
  await fireEvent.press(screen.getByRole('button', { name: 'Add weight (vest, plate)' }));
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '10');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '12');
  await fireEvent.press(screen.getByRole('button', { name: 'Save Push-up' }));
  await screen.findByRole('header', { name: 'Workouts' });
  expect((await recentLifts(mockDb))[0].sets[0]).toMatchObject({ weightKg: 10, reps: 12 });
});

test('a plank is timed, and a longer hold shows as a PR before saving', async () => {
  await logLift(mockDb, {
    exerciseId: 'ex_plank',
    at: new Date('2026-10-20T08:00:00Z'),
    sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: 85 }],
  });
  await startLift('plank', 'Plank');
  expect(screen.queryByLabelText('Reps for set 1')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Time for set 1'), '1:30');
  expect(await screen.findByText('Longest hold: 1:30 (was 1:25)')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Save Plank' }));
  await screen.findByRole('header', { name: 'Workouts' });
  expect((await recentLifts(mockDb))[0].sets[0]).toMatchObject({ reps: null, durationSeconds: 90 });
});

test('the timer fills in the time', async () => {
  await startLift('plank', 'Plank');
  await fireEvent.press(screen.getByRole('button', { name: 'Start timer for set 1' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(5_000);
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Stop timer for set 1' }));
  expect(screen.getByLabelText('Time for set 1').props.value).toBe('0:05');
});

test('pressing Save twice quickly logs the lift once', async () => {
  await startLift('bench', 'Barbell bench press');
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '60');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '10');
  const save = screen.getByRole('button', { name: 'Save Barbell bench press' });
  await act(async () => {
    fireEvent.press(save);
    fireEvent.press(save);
  });
  await screen.findByRole('header', { name: 'Workouts' });
  expect(await recentLifts(mockDb)).toHaveLength(1);
});

test('recent exercises are one tap away', async () => {
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-21T08:00:00Z'),
    sets: [{ weightKg: 80, reps: 8, effort: null }],
  });
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Recent: Barbell bench press' }));
  expect(await screen.findByLabelText('Weight for set 1')).toBeTruthy();
});

test('Progress shows the longest plank and the most ab-wheel reps', async () => {
  await logLift(mockDb, {
    exerciseId: 'ex_plank',
    at: new Date('2026-10-20T08:00:00Z'),
    sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: 90 }],
  });
  await logLift(mockDb, {
    exerciseId: 'ex_ab_wheel_rollout',
    at: new Date('2026-10-21T08:00:00Z'),
    sets: [{ weightKg: null, reps: 15, effort: null }],
  });
  await renderRouter(appDir, { initialUrl: '/progress' });
  const plank = within(await screen.findByLabelText('Records for Plank'));
  expect(plank.getByText('1:30')).toBeTruthy();
  expect(plank.getByText('Longest hold')).toBeTruthy();
  const wheel = within(screen.getByLabelText('Records for Ab wheel rollout'));
  expect(wheel.getByText('15 reps')).toBeTruthy();
});

test('saving a PR gives a success buzz', async () => {
  const buzz = jest.spyOn(Haptics, 'notificationAsync');
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-20T08:00:00Z'),
    sets: [{ weightKg: 80, reps: 5, effort: null }],
  });
  await startLift('bench', 'Barbell bench press');
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '85');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '5');
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));
  await screen.findByRole('header', { name: 'Workouts' });
  expect(buzz).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
});

test('an older plank logged as reps can still be edited as reps', async () => {
  const { workoutId } = await logLift(mockDb, {
    exerciseId: 'ex_plank',
    at: new Date('2026-10-01T08:00:00Z'),
    sets: [{ weightKg: null, reps: 60, effort: null }],
  });
  await renderRouter(appDir, { initialUrl: `/lift/${workoutId}` });
  expect((await screen.findByLabelText('Reps for set 1')).props.value).toBe('60');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '70');
  await fireEvent.press(screen.getByRole('button', { name: 'Save Plank' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  expect((await recentLifts(mockDb))[0].sets[0]).toMatchObject({ reps: 70 });
});

test('effort answers back: a light tick when easy, a heavy one near the limit', async () => {
  const impact = jest.spyOn(Haptics, 'impactAsync').mockResolvedValue(undefined);
  await startLift('bench', 'Barbell bench press');
  await fireEvent.press(screen.getByRole('button', { name: 'Set 1 effort 2' }));
  expect(impact).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Light);
  await fireEvent.press(screen.getByRole('button', { name: 'Set 1 effort 9' }));
  expect(impact).toHaveBeenLastCalledWith(Haptics.ImpactFeedbackStyle.Heavy);
  expect(screen.getByRole('button', { name: 'Set 1 effort 9' }).props.accessibilityState.selected).toBe(true);
  impact.mockRestore();
});

test('a spotter helped with the last two reps: effort 10, shown on the set, and a Spotter PR rather than a solo one', async () => {
  await logLift(mockDb, {
    exerciseId: BENCH,
    at: new Date('2026-10-20T17:30:00Z'),
    sets: [{ weightKg: 100, reps: 5, effort: 9 }],
  });
  await startLift('bench', 'Barbell bench press');
  await fireEvent.changeText(screen.getByLabelText('Weight for set 1'), '100');
  await fireEvent.changeText(screen.getByLabelText('Reps for set 1'), '6');
  await fireEvent(screen.getByLabelText('Spotter helped on set 1'), 'valueChange', true);
  expect(screen.getByText('Last 1 rep')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Set 1 effort 10' }).props.accessibilityState.selected).toBe(true);
  await fireEvent.press(screen.getByRole('button', { name: 'One more helped rep on set 1' }));
  expect(screen.getByText('Last 2 reps')).toBeTruthy();
  expect(await screen.findByText('Spotter PR: 100 kg × 6 (last 2 helped)')).toBeTruthy();
  expect(screen.queryByText(/^Most reps at 100 kg/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Save / }));

  await screen.findByRole('header', { name: 'Workouts' });
  expect(await screen.findByText('100 kg × 6 (last 2 helped) @ 10')).toBeTruthy();
  const [latest] = await recentLifts(mockDb, 1);
  expect(latest.sets[0]).toMatchObject({ reps: 6, assistedReps: 2, effort: 10 });
});
