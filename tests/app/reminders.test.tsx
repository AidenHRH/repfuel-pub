import * as Notifications from 'expo-notifications';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { getCreatineSettings, getReminder, isDone, takenOn } from '@/database/repositories/reminderRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T06:30:00Z'), advanceTimers: true }); // 07:30 London
  mockDb = await migratedDb();
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' } as never);
  jest.mocked(Notifications.scheduleNotificationAsync).mockClear();
});
afterEach(() => jest.useRealTimers());

async function openSettings() {
  await renderRouter(appDir, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
}

test('switch on the creatine reminder, move its time, and it is scheduled', async () => {
  await openSettings();
  const toggle = await screen.findByLabelText('Creatine reminder');
  expect(toggle.props.value).toBe(false);
  await fireEvent(toggle, 'valueChange', true);

  expect(await screen.findByText('08:00')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Remind 15 minutes later' }));
  expect(await screen.findByText('08:15')).toBeTruthy();
  expect(await getReminder(mockDb, 'creatine')).toMatchObject({ enabled: true, hour: 8, minute: 15 });
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
});

test('if notifications are turned off for RepFuel, it says so and stays off', async () => {
  jest
    .mocked(Notifications.getPermissionsAsync)
    .mockResolvedValue({ granted: false, canAskAgain: false, status: 'denied' } as never);
  await openSettings();
  await fireEvent(await screen.findByLabelText('Creatine reminder'), 'valueChange', true);
  expect(await screen.findByText(/Notifications are turned off for RepFuel/)).toBeTruthy();
  expect((await getReminder(mockDb, 'creatine'))?.enabled).toBe(false);
});

test('Today shows creatine once it is on; tick it off, and untick a mistake', async () => {
  await openSettings();
  await fireEvent(await screen.findByLabelText('Creatine reminder'), 'valueChange', true);
  await fireEvent.press(screen.getByLabelText(/^Summary, tab/));
  await screen.findByRole('header', { name: 'Summary' });

  await fireEvent.press(await screen.findByRole('button', { name: 'Mark creatine taken' }));
  expect(await screen.findByText('5 g today')).toBeTruthy();
  expect(await isDone(mockDb, 'creatine')).toBe(true);

  await fireEvent.press(screen.getByRole('button', { name: 'Undo creatine taken' }));
  expect(await screen.findByRole('button', { name: 'Mark creatine taken' })).toBeTruthy();
  expect(await isDone(mockDb, 'creatine')).toBe(false);
});

test('Today shows nothing for a reminder that is off', async () => {
  await renderRouter(appDir, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Summary' });
  expect(screen.queryByRole('button', { name: 'Mark creatine taken' })).toBeNull();
});

test('how much creatine: 10 g a day in 2.5 g scoops, half now and the rest with Taken', async () => {
  await openSettings();
  await fireEvent(await screen.findByLabelText('Creatine reminder'), 'valueChange', true);
  await fireEvent.press(await screen.findByRole('button', { name: 'More creatine a day' }));
  await fireEvent.press(screen.getByRole('button', { name: 'More creatine a day' }));
  expect(await screen.findByText('10 g')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '2.5 g' }));
  expect(await getCreatineSettings(mockDb)).toEqual({ dailyG: 10, scoopG: 2.5 });

  await fireEvent.press(screen.getByLabelText(/^Summary, tab/));
  await screen.findByRole('header', { name: 'Summary' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose how much creatine' }));
  await screen.findByRole('header', { name: 'How much creatine?' });
  await fireEvent.press(screen.getByRole('button', { name: '5 g · 2 scoops' }));
  expect(await screen.findByText('5 of 10 g today')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Mark creatine taken' }));
  expect(await screen.findByText('10 g today')).toBeTruthy();
  expect(await takenOn(mockDb, 'creatine')).toEqual({ done: true, grams: 10 });
  expect(screen.getByRole('button', { name: 'Undo creatine taken' })).toBeTruthy();
});
