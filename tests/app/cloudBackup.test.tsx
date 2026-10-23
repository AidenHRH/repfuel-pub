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

test('sign in with an emailed code, then it backs up straight away', async () => {
  const fake = fakeCloud(null);
  __setFake(fake);
  await createRecipe(mockDb, { name: 'Oats', portionsMade: 1, ingredients: [] });
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on cloud backup' }));
  await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(fake.state.codeSentTo).toBe('me@example.com');
  await fireEvent.changeText(await screen.findByLabelText('Code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('me@example.com')).toBeTruthy();
  expect(await screen.findByText('14:32 today')).toBeTruthy();
  expect([...fake.files.keys()]).toEqual(['user-1/backup-2026-10-23.json']);
});

test('a wrong code says so and stays on the code', async () => {
  __setFake(fakeCloud(null));
  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on cloud backup' }));
  await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await fireEvent.changeText(await screen.findByLabelText('Code'), '000000');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/That code didn’t work/)).toBeTruthy();
  expect(screen.getByLabelText('Code')).toBeTruthy();
});

test('signing in on an empty phone offers the backup, and restores it', async () => {
  const fake = fakeCloud(null);
  const old = await migratedDb();
  await createRecipe(old, { name: 'Overnight oats', portionsMade: 1, ingredients: [] });
  await backupNow(old, fake.cloud, 'user-1', new Date('2026-10-22T09:00:00Z'));
  __setFake(fake);
  const alert = jest.spyOn(Alert, 'alert');

  await openSettings();
  await fireEvent.press(screen.getByRole('button', { name: 'Turn on cloud backup' }));
  await fireEvent.changeText(screen.getByLabelText('Email'), 'me@example.com');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await fireEvent.changeText(await screen.findByLabelText('Code'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));

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
