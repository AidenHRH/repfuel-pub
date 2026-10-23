import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';
import { Alert } from 'react-native';

import type { Db } from '@/database/Db';
import { backupNow } from '@/database/cloudBackup';
import { createRecipe, listRecipes } from '@/database/repositories/recipeRepository';

import { fakeCloud } from '../helpers/fakeCloud';
import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
const { __setFake } = jest.requireMock('@/services/cloud') as { __setFake: (f: ReturnType<typeof fakeCloud>) => void };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-23T13:32:00Z'), advanceTimers: true }); // 14:32 London
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openSettings() {
  await renderRouter(appDir, { initialUrl: '/settings' });
  return screen.findByRole('button', { name: /Turn on cloud backup|Sync now/ });
}

async function signInWith(email: string, password: string, button: 'Sign in' | 'Create account' = 'Sign in') {
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on cloud backup' }));
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
  await fireEvent.press(screen.getByRole('button', { name: button }));
}

test('sign in with email and password, then it backs up straight away', async () => {
  const fake = fakeCloud(null);
  __setFake(fake);
  await createRecipe(mockDb, { name: 'Oats', portionsMade: 1, ingredients: [] });
  await openSettings();
  await signInWith('me@example.com', 'right-password');
  expect(await screen.findByText('me@example.com')).toBeTruthy();
  expect(await screen.findByText('14:32 today')).toBeTruthy();
  expect([...fake.files.keys()]).toEqual(['user-1/backup-2026-10-23.json']);
});

test('the password is hidden while typing', async () => {
  __setFake(fakeCloud(null));
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on cloud backup' }));
  expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
});

test('a wrong password says so and keeps the form open', async () => {
  __setFake(fakeCloud(null));
  await openSettings();
  await signInWith('me@example.com', 'nope-nope');
  expect(await screen.findByText(/That email and password don’t match/)).toBeTruthy();
  expect(screen.getByLabelText('Password')).toBeTruthy();
});

test('create an account the first time', async () => {
  const fake = fakeCloud(null);
  __setFake(fake);
  await openSettings();
  await signInWith('friend@example.com', 'short', 'Create account');
  expect(await screen.findByText(/at least 6 characters/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Password'), 'long-enough');
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('friend@example.com')).toBeTruthy();
  expect(fake.state.accounts.get('friend@example.com')).toBe('long-enough');
});

test('creating an account for an email that has one says to sign in instead', async () => {
  __setFake(fakeCloud(null));
  await openSettings();
  await signInWith('me@example.com', 'whatever-123', 'Create account');
  expect(await screen.findByText(/already has an account\. Sign in instead/)).toBeTruthy();
});

test('signing in on an empty phone offers the backup, and restores it', async () => {
  const fake = fakeCloud(null);
  const old = await migratedDb();
  await createRecipe(old, { name: 'Overnight oats', portionsMade: 1, ingredients: [] });
  await backupNow(old, fake.cloud, 'user-1', new Date('2026-10-22T09:00:00Z'));
  __setFake(fake);
  const alert = jest.spyOn(Alert, 'alert');

  await openSettings();
  await signInWith('me@example.com', 'right-password');

  await act(async () => undefined);
  const offer = alert.mock.calls.find((c) => c[0] === 'Restore your backup?');
  expect(offer?.[1]).toMatch(/22 October/);
  const restore = offer![2]!.find((b) => b.text === 'Restore')!;
  await act(async () => restore.onPress!());
  expect((await listRecipes(mockDb, {})).map((r) => r.name)).toEqual(['Overnight oats']);
});

test('Sync now when offline says it will try again, and the phone is untouched', async () => {
  const fake = fakeCloud();
  __setFake(fake);
  await createRecipe(mockDb, { name: 'Oats', portionsMade: 1, ingredients: [] });
  await openSettings();
  // Something new since the backup made on opening, so Sync now has to reach the server.
  await createRecipe(mockDb, { name: 'Chilli', portionsMade: 4, ingredients: [] });
  fake.state.failWith = 'offline';
  await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  expect(await screen.findByText(/Not backed up yet\. It’ll try again when you’re online/)).toBeTruthy();
  fake.state.failWith = 'unreachable';
  await fireEvent.press(screen.getByRole('button', { name: 'Sync now' }));
  expect(await screen.findByText(/press Restore project/)).toBeTruthy();
  expect(await listRecipes(mockDb, {})).toHaveLength(2);
});

test('opening the app backs up quietly when signed in', async () => {
  const fake = fakeCloud();
  __setFake(fake);
  await createRecipe(mockDb, { name: 'Oats', portionsMade: 1, ingredients: [] });
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findAllByText(/kcal/);
  await act(async () => undefined);
  expect([...fake.files.keys()]).toEqual(['user-1/backup-2026-10-23.json']);
});

test('sign out', async () => {
  const fake = fakeCloud();
  __setFake(fake);
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByRole('button', { name: 'Turn on cloud backup' })).toBeTruthy();
  expect(fake.state.user).toBeNull();
});
