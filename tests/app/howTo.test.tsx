import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as WebBrowser from 'expo-web-browser';
import path from 'path';

import type { Db } from '@/database/Db';
import { createExercise, getExercise } from '@/database/repositories/exerciseRepository';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');
const BENCH = 'ex_barbell_bench_press';
const PHOTOS = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/';

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-23T17:30:00Z'), advanceTimers: true });
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openHowTo(id: string, header: string) {
  await renderRouter(appDir, { initialUrl: '/' });
  const { router } = jest.requireActual('expo-router');
  await act(async () => router.push(`/exercise/${id}`));
  await screen.findByRole('header', { name: header });
}

test('bench press: start and end photos, numbered steps, and credit', async () => {
  await openHowTo(BENCH, 'Barbell bench press');
  expect(screen.getByLabelText('Barbell bench press, start').props.source).toEqual([{ uri: `${PHOTOS}0.jpg` }]);
  expect(screen.getByLabelText('Barbell bench press, end').props.source).toEqual([{ uri: `${PHOTOS}1.jpg` }]);
  expect(screen.getByText(/^1\. Lie back on a flat bench/)).toBeTruthy();
  expect(screen.getByText('Steps and photos: Free Exercise DB')).toBeTruthy();
});

test('Find a video searches YouTube; a pasted link plays here, and can be removed', async () => {
  const open = jest.spyOn(WebBrowser, 'openBrowserAsync').mockResolvedValue({ type: 'opened' } as never);
  await openHowTo(BENCH, 'Barbell bench press');
  await fireEvent.press(screen.getByRole('button', { name: 'Find a video' }));
  expect(open).toHaveBeenCalledWith('https://www.youtube.com/results?search_query=how+to+barbell+bench+press');

  await fireEvent.press(screen.getByRole('button', { name: 'Add a video' }));
  await fireEvent.changeText(screen.getByLabelText('YouTube link'), 'https://vimeo.com/1');
  await fireEvent.press(screen.getByRole('button', { name: 'Save video' }));
  expect(await screen.findByText('That isn’t a YouTube video link.')).toBeTruthy();

  await fireEvent.changeText(screen.getByLabelText('YouTube link'), 'https://youtu.be/dQw4w9WgXcQ?si=abc');
  await fireEvent.press(screen.getByRole('button', { name: 'Save video' }));
  expect((await screen.findByLabelText('Video')).props.source).toEqual({
    uri: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
  });
  expect((await getExercise(mockDb, BENCH))!.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ?si=abc');

  await fireEvent.press(screen.getByRole('button', { name: 'Remove video' }));
  expect(await screen.findByRole('button', { name: 'Add a video' })).toBeTruthy();
  expect(screen.queryByLabelText('Video')).toBeNull();
  open.mockRestore();
});

test('an exercise you added has no guide, but can still have a video', async () => {
  const mine = await createExercise(mockDb, {
    name: 'Landmine press',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
    isBodyweight: false,
  });
  await openHowTo(mine.id, 'Landmine press');
  expect(screen.getByText('No guide for this one yet')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add a video' })).toBeTruthy();
});

test('How to from Log workout and from Progress', async () => {
  await renderRouter(appDir, { initialUrl: '/workouts' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Log workout' }));
  await fireEvent.changeText(await screen.findByLabelText('Search exercises'), 'bench');
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose Barbell bench press' }));
  await fireEvent.press(screen.getByRole('button', { name: 'How to' }));
  expect(await screen.findByText('Steps and photos: Free Exercise DB')).toBeTruthy();
});
