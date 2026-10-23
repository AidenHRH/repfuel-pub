import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';

import type { Db } from '@/database/Db';
import { logClass, recentClasses } from '@/database/repositories/classRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T17:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openClass() {
  await renderRouter(appDir, { initialUrl: '/' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
  await screen.findByRole('header', { name: 'Log workout' });
  await fireEvent.press(screen.getByRole('button', { name: 'Class' }));
}

test('log a Hyrox class: how long, how hard, a note', async () => {
  await openClass();
  await fireEvent.press(await screen.findByRole('button', { name: 'Hyrox' }));
  await fireEvent.press(screen.getByRole('button', { name: '5 minutes more' }));
  await fireEvent.press(screen.getByRole('button', { name: '9, Very, very hard' }));
  await fireEvent.changeText(screen.getByLabelText('Notes'), 'PB on the sled push');
  await fireEvent.press(screen.getByRole('button', { name: 'Save Hyrox' }));

  expect(await screen.findByText('Saved Hyrox')).toBeTruthy();
  expect(await recentClasses(mockDb)).toEqual([
    expect.objectContaining({
      className: 'Hyrox',
      durationMin: 65,
      effort: 9,
      notes: 'PB on the sled push',
      at: '2026-10-22T17:30:00.000Z',
    }),
  ]);
});

test("a class from yesterday keeps today's clock time", async () => {
  await openClass();
  await fireEvent.press(await screen.findByRole('button', { name: 'Spin' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Yesterday' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save Spin' }));
  await screen.findByText('Saved Spin');
  expect((await recentClasses(mockDb))[0].at).toBe('2026-10-21T17:30:00.000Z');
});

test('add your own class type', async () => {
  await openClass();
  await fireEvent.press(await screen.findByRole('button', { name: 'New class' }));
  await fireEvent.changeText(await screen.findByLabelText('Class name'), 'Yoga');
  await fireEvent.press(screen.getByRole('button', { name: 'Add class' }));
  expect(await screen.findByRole('button', { name: 'Save Yoga' })).toBeTruthy();
});

test('Save waits until a class is chosen, and saves once however fast you tap', async () => {
  await openClass();
  expect(await screen.findByRole('button', { name: /^Save/ })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'HIIT' }));
  const save = screen.getByRole('button', { name: 'Save HIIT' });
  await act(async () => {
    fireEvent.press(save);
    fireEvent.press(save);
  });
  await screen.findByText('Saved HIIT');
  expect(await recentClasses(mockDb)).toHaveLength(1);
});

test('edit a class, or delete it', async () => {
  const saved = await logClass(mockDb, {
    classTypeId: 'class_hyrox',
    at: new Date('2026-10-20T17:30:00Z'),
    durationMin: 60,
    effort: 8,
    notes: null,
  });
  await renderRouter(appDir, { initialUrl: `/class/${saved.id}` });
  await screen.findByRole('header', { name: 'Edit class' });
  expect(screen.queryByRole('button', { name: 'Exercise' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: '5 minutes less' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save Hyrox' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  expect((await recentClasses(mockDb))[0]).toMatchObject({ durationMin: 55, at: '2026-10-20T17:30:00.000Z' });
});
