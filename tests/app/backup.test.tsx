import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';
import { Alert } from 'react-native';

import { exportBackup } from '@/database/backup';
import type { Db } from '@/database/Db';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';

import { migratedDb, seedRegulars } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
const MockFile = File as unknown as { store: Map<string, string>; pickFileAsync: jest.Mock };

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T12:00:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
  MockFile.store.clear();
});
afterEach(() => jest.useRealTimers());

async function openSettings() {
  await renderRouter(appDir, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
}

test('Back up to a file writes everything and opens the share sheet', async () => {
  const { overnightOats } = await seedRegulars(mockDb);
  await logLoggable(mockDb, { kind: 'recipe', id: overnightOats.id }, 1, new Date());
  await openSettings();
  await fireEvent.press(await screen.findByRole('button', { name: 'Back up to a file' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  const [uri] = jest.mocked(Sharing.shareAsync).mock.calls.at(-1)!;
  expect(uri).toMatch(/RepFuel-backup-2026-10-22\.json$/);
  const saved = JSON.parse(MockFile.store.get(uri)!);
  expect(saved.app).toBe('RepFuel');
  expect(saved.tables.food_log_entry).toHaveLength(1);
});

test('Restore from a file asks first, then replaces what is on the phone', async () => {
  const other = await migratedDb();
  const { overnightOats } = await seedRegulars(other);
  await logLoggable(other, { kind: 'recipe', id: overnightOats.id }, 1, new Date());
  const picked = new File('file:///downloads/backup.json');
  await picked.write(JSON.stringify(await exportBackup(other)));
  MockFile.pickFileAsync.mockResolvedValueOnce({ canceled: false, result: picked });
  const alert = jest.spyOn(Alert, 'alert');

  await openSettings();
  await fireEvent.press(await screen.findByRole('button', { name: 'Restore from a file' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  const buttons = alert.mock.calls.at(-1)![2]!;
  expect(alert.mock.calls.at(-1)![0]).toBe('Replace everything on this phone?');
  await act(async () => {
    await buttons.find((b) => b.text === 'Restore')!.onPress!();
  });
  expect(await entriesForDay(mockDb, '2026-10-22')).toHaveLength(1);
});

test('a file that is not a backup is explained, and nothing changes', async () => {
  const picked = new File('file:///downloads/photo.json');
  await picked.write('{"hello":1}');
  MockFile.pickFileAsync.mockResolvedValueOnce({ canceled: false, result: picked });
  const alert = jest.spyOn(Alert, 'alert');
  await openSettings();
  await fireEvent.press(await screen.findByRole('button', { name: 'Restore from a file' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  expect(alert).toHaveBeenLastCalledWith('Couldn’t restore', 'That file isn’t a RepFuel backup.');
});
