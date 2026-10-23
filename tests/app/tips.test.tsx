import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { getTourState, recordUse, saveTourState } from '@/database/repositories/tourRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
const now = new Date('2026-10-27T11:30:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

beforeEach(async () => {
  jest.useFakeTimers({ now, advanceTimers: true });
  mockDb = await migratedDb();
  // The tour was four days ago; tips are on.
  await saveTourState(mockDb, { doneAt: daysAgo(4), tipsOn: true });
});
afterEach(() => jest.useRealTimers());

async function openLogFood() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
}

async function noTip() {
  await act(async () => jest.advanceTimersByTime(800));
  expect(screen.queryByLabelText('Tip')).toBeNull();
}

test('Log food, nothing scanned yet: a tip about scanning, shown once', async () => {
  await openLogFood();
  const tip = await screen.findByLabelText('Tip');
  expect(within(tip).getByText('Scan a barcode')).toBeTruthy();
  await fireEvent.press(within(tip).getByRole('button', { name: 'Got it' }));
  await noTip();
  const state = await getTourState(mockDb);
  expect(state.shown).toEqual(['scan']);
  expect(state.lastTipAt).not.toBeNull();

  // Opening Log food again: no tip (that one's done, and the next waits three days).
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Log food' }));
  await screen.findByRole('header', { name: 'Log food' });
  await noTip();
});

test('after a scan today, Log food offers the snack tiles tip instead', async () => {
  await recordUse(mockDb, 'scan', now);
  await openLogFood();
  const tip = await screen.findByLabelText('Tip');
  expect(within(tip).getByText('Snack tiles')).toBeTruthy();
});

test('no tips in the first day after the tour, or with Helpful tips off', async () => {
  await saveTourState(mockDb, { doneAt: daysAgo(0.5) });
  await openLogFood();
  await noTip();
});

test('Settings: Show the tour again starts the tour on Summary', async () => {
  await renderRouter(appDir, { initialUrl: '/settings' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Show the tour again' }));
  expect(await screen.findByText('1 of 8')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Summary' })).toBeTruthy();
});

test('Settings: turning Helpful tips off stops them; off and on again lets seen tips come back', async () => {
  await saveTourState(mockDb, { shown: ['scan'], lastTipAt: daysAgo(5) });
  await renderRouter(appDir, { initialUrl: '/settings' });
  const tips = await screen.findByLabelText('Helpful tips');
  expect(tips.props.value).toBe(true);
  await fireEvent(tips, 'valueChange', false);
  await act(async () => jest.advanceTimersByTime(200));
  expect((await getTourState(mockDb)).tipsOn).toBe(false);
  await fireEvent(screen.getByLabelText('Helpful tips'), 'valueChange', true);
  await act(async () => jest.advanceTimersByTime(200));
  expect(await getTourState(mockDb)).toMatchObject({ tipsOn: true, shown: [] });
});
