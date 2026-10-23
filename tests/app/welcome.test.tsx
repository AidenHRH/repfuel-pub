import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { runMigrations } from '@/database/migrate';
import { getProfile } from '@/database/repositories/profileRepository';
import { setSetting } from '@/database/repositories/settingsRepository';
import { getSetup } from '@/database/repositories/setupRepository';
import { getCurrentTargets } from '@/database/repositories/targetsRepository';

import { migratedDb } from '../helpers/seed';
import { createTestDb } from '../helpers/testDb';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

/** A brand-new install: not set up, tour already seen so it stays out of the way. */
async function newPhone() {
  const db = createTestDb();
  await runMigrations(db);
  await setSetting(db, 'tour', { doneAt: '2026-01-01T00:00:00.000Z', tipsOn: false, shown: [], lastTipAt: null });
  return db;
}

test('a new phone asks about you, suggests realistic targets, and saves them', async () => {
  mockDb = await newPhone();
  await renderRouter(appDir, { initialUrl: '/' });
  expect(await screen.findByText('Welcome to RepFuel')).toBeTruthy();
  const next = () => screen.getByRole('button', { name: 'Next' });
  expect(next().props.accessibilityState.disabled).toBe(true);

  await fireEvent.changeText(screen.getByLabelText('Age'), '30');
  await fireEvent.changeText(screen.getByLabelText('Height'), '175');
  await fireEvent.changeText(screen.getByLabelText('Weight'), '75');
  await fireEvent.press(screen.getByRole('button', { name: 'Male' }));
  await fireEvent.press(next());

  await fireEvent.press(await screen.findByRole('radio', { name: /^Active/ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Lose fat' }));
  await fireEvent.press(next());

  expect(await screen.findByText(/BMI 24\.5 · healthy range/)).toBeTruthy();
  expect(screen.getByLabelText('Calorie target').props.value).toBe('2150');
  expect(screen.getByLabelText('Protein target').props.value).toBe('135');
  expect(screen.getByText(/about 0\.5 kg a week/i)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Start using RepFuel' }));
  expect((await getSetup(mockDb)).done).toBe(true);
  expect(await getProfile(mockDb)).toMatchObject({ age: 30, heightCm: 175, currentWeightKg: 75, primaryGoal: 'Lose fat' });
  expect(await getCurrentTargets(mockDb, new Date(Date.now() + 5000))).toMatchObject({ caloriesKcal: 2150, proteinGrams: 135 });
});

test('the suggested targets can be changed before starting', async () => {
  mockDb = await newPhone();
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.changeText(await screen.findByLabelText('Age'), '40');
  await fireEvent.changeText(screen.getByLabelText('Height'), '165');
  await fireEvent.changeText(screen.getByLabelText('Weight'), '68');
  await fireEvent.press(screen.getByRole('button', { name: 'Prefer not to say' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.press(await screen.findByRole('radio', { name: /^Lightly active/ }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Stay where I am' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.changeText(await screen.findByLabelText('Calorie target'), '2000');
  await fireEvent.press(screen.getByRole('button', { name: 'Start using RepFuel' }));
  expect(await getCurrentTargets(mockDb, new Date(Date.now() + 5000))).toMatchObject({ caloriesKcal: 2000 });
});

test('a phone that is already set up never sees the welcome', async () => {
  mockDb = await migratedDb();
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findAllByText(/kcal/);
  expect(screen.queryByText('Welcome to RepFuel')).toBeNull();
});
