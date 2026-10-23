import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { getSetting } from '@/database/repositories/settingsRepository';

import { createTestDb } from '../helpers/testDb';

let mockDb: Db;
let mockOpenError: Error | null = null;

jest.mock('@/database/expoDb', () => ({
  openExpoDb: async () => {
    if (mockOpenError) throw mockOpenError;
    return mockDb;
  },
}));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(() => {
  mockDb = createTestDb();
  mockOpenError = null;
});

async function openSettings() {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Summary' });
  await fireEvent.press(screen.getByLabelText(/^Settings, tab/));
  await screen.findByRole('header', { name: 'Settings' });
}

test('Settings shows the saved daily targets', async () => {
  await openSettings();
  expect(screen.getByText('2,500 kcal')).toBeTruthy();
  expect(screen.getByText('145 g')).toBeTruthy();
});

test('choosing Light appearance is saved for next launch', async () => {
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Light' }));

  expect(await getSetting(mockDb, 'appearance', 'dark')).toBe('light');
  expect(screen.getByRole('button', { name: 'Light', selected: true })).toBeTruthy();
});

test('a saved Light appearance is used on launch', async () => {
  await mockDb.exec('PRAGMA user_version = 0');
  const { runMigrations } = jest.requireActual('@/database/migrate');
  const { setSetting } = jest.requireActual('@/database/repositories/settingsRepository');
  await runMigrations(mockDb);
  await setSetting(mockDb, 'appearance', 'light');

  await openSettings();
  expect(screen.getByRole('button', { name: 'Light', selected: true })).toBeTruthy();
});

test('if the database cannot open, the app explains instead of showing a blank screen', async () => {
  mockOpenError = new Error('disk I/O error');
  await renderRouter(appDir, { initialUrl: '/' });
  expect(await screen.findByText("RepFuel couldn't open your data")).toBeTruthy();
  expect(screen.getByText('disk I/O error')).toBeTruthy();
});

test('editing the protein target updates Today', async () => {
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Protein, 145 g' }));
  await fireEvent.changeText(await screen.findByLabelText('Protein target'), '150');
  await fireEvent.press(screen.getByRole('button', { name: 'Save targets' }));
  expect(await screen.findByText('150 g')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText(/^Summary, tab/));
  expect(await screen.findByText('/ 150 g')).toBeTruthy();
});

test('targets must be sensible numbers', async () => {
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Calories, 2,500 kcal' }));
  await fireEvent.changeText(await screen.findByLabelText('Calorie target'), '0');
  expect(screen.getByRole('button', { name: 'Save targets' })).toBeDisabled();
});
