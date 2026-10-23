import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import path from 'path';
import { Share } from 'react-native';

import type { Db } from '@/database/Db';
import { entriesForDay } from '@/database/repositories/foodLogRepository';
import {
  getDietPrefs,
  getPlan,
  makePlan,
  planDayKeys,
  prepDayKeys,
  setPrepSettings,
} from '@/database/repositories/mealPlanRepository';
import { DEFAULT_PREP } from '@/domain/prepPlan';
import { getMealTemplate, templateTags } from '@/domain/mealTemplates';

import { migratedDb } from '../helpers/seed';

let mockDb: Db;
jest.mock('@/database/expoDb', () => ({ openExpoDb: async () => mockDb }));

const appDir = path.resolve(__dirname, '../../src/app');

beforeEach(async () => {
  jest.useFakeTimers({ now: new Date('2026-10-22T11:30:00Z'), advanceTimers: true }); // 12:30 London
  mockDb = await migratedDb();
});
afterEach(() => jest.useRealTimers());

async function openPlan() {
  await renderRouter(appDir, { initialUrl: '/nutrition' });
  await fireEvent.press(await screen.findByRole('button', { name: 'Plan' }));
  await screen.findByRole('button', { name: 'Suggest meals' });
}

/** The planned meal for each slot on each prep day, as "slot:kind:id×portions". */
async function prepRows(days: string[]) {
  return (await getPlan(mockDb, days)).map((d) => d.meals.map((m) => `${m.slot}:${m.kind}:${m.id}×${m.portions}`));
}

test('suggest a 3-day prep from tomorrow: one dish per meal every day, with per-day and whole-prep macros', async () => {
  await openPlan();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest meals' }));
  expect(await screen.findByRole('button', { name: /^Breakfast: / })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Lunch: / })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Dinner: / })).toBeTruthy();
  expect(screen.getByLabelText(/^Per day: [\d,]+ kcal · \d+ g protein/)).toBeTruthy();
  expect(screen.getByLabelText(/^Whole prep, 3 days: [\d,]+ kcal/)).toBeTruthy();

  const days = prepDayKeys(DEFAULT_PREP, new Date());
  expect(days[0]).toBe('2026-10-23');
  const rows = await prepRows(days);
  expect(rows[0]).toHaveLength(3);
  expect(rows[1]).toEqual(rows[0]);
  expect(rows[2]).toEqual(rows[0]);
});

test('just lunch and dinner for 2 days', async () => {
  await openPlan();
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Plan breakfast' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Fewer days' }));
  expect(await screen.findByText('2 days')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest meals' }));
  await screen.findByRole('button', { name: /^Lunch: / });
  expect(screen.queryByRole('button', { name: /^Breakfast: / })).toBeNull();
  const rows = await prepRows(prepDayKeys({ days: 2, start: 'tomorrow', slots: ['lunch', 'dinner'] }, new Date()));
  expect(rows.map((r) => r.map((x) => x.split(':')[0]))).toEqual([
    ['lunch', 'dinner'],
    ['lunch', 'dinner'],
  ]);
});

test('Shuffle changes that meal on every prep day, and nothing else', async () => {
  await openPlan();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest meals' }));
  await screen.findByRole('button', { name: /^Lunch: / });
  const days = prepDayKeys(DEFAULT_PREP, new Date());
  const before = await prepRows(days);
  await fireEvent.press(screen.getByRole('button', { name: 'Shuffle lunch' }));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(50);
  });
  const after = await prepRows(days);
  expect(after[0][1]).not.toEqual(before[0][1]);
  expect(after.every((d) => d[1] === after[0][1])).toBe(true);
  expect([after[0][0], after[0][2]]).toEqual([before[0][0], before[0][2]]);
});

test('Browse: choose a recipe for lunch', async () => {
  await openPlan();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest meals' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Browse lunch' }));
  await screen.findByRole('header', { name: 'Choose lunch' });
  await fireEvent.press(screen.getByRole('button', { name: /^Chicken pesto pasta, / }));
  expect(await screen.findByRole('button', { name: 'Lunch: Chicken pesto pasta' })).toBeTruthy();
});

test('vegetarian: no meat or fish in the suggestions', async () => {
  await openPlan();
  await fireEvent.press(screen.getByRole('button', { name: 'Change diet' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Vegetarian' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save and re-plan' }));
  await screen.findByRole('button', { name: /^Dinner: / });
  expect((await getDietPrefs(mockDb)).style).toBe('vegetarian');
  const plan = await getPlan(mockDb, prepDayKeys(DEFAULT_PREP, new Date()));
  for (const m of plan.flatMap((d) => d.meals)) {
    const tags = templateTags(getMealTemplate(m.id)!);
    expect([m.id, tags.has('meat') || tags.has('fish')]).toEqual([m.id, false]);
  }
});

test('from today: log today’s lunch, then the shopping list', async () => {
  await setPrepSettings(mockDb, { ...DEFAULT_PREP, start: 'today' });
  await openPlan();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest meals' }));
  const lunchCard = await screen.findByRole('button', { name: /^Lunch: / });
  const name = lunchCard.props.accessibilityLabel.replace('Lunch: ', '');
  await fireEvent.press(screen.getByRole('button', { name: `Log ${name} for lunch` }));
  expect(await screen.findByLabelText(`${name} logged`)).toBeTruthy();
  expect(await entriesForDay(mockDb, '2026-10-22')).toEqual([expect.objectContaining({ name, mealCategory: 'lunch' })]);

  await fireEvent.press(screen.getByRole('button', { name: 'Shopping list' }));
  await screen.findByRole('header', { name: 'Shopping list' });
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
  await fireEvent.press(screen.getByRole('button', { name: 'Share list' }));
  expect(share.mock.calls[0][0].message).toMatch(/^Shopping list\n\n/);
});

test('a plan from before prep plans still shows, day by day', async () => {
  await makePlan(mockDb, { from: new Date('2026-10-23T09:00:00Z'), seed: 7 });
  await openPlan();
  expect(await screen.findByText(/earlier plan has different meals each day/)).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Friday 23 Oct' })).toBeTruthy();
});

test('meal prep: a cooking session for the prep, batch recipes made by their recipe', async () => {
  await setPrepSettings(mockDb, { ...DEFAULT_PREP, slots: ['dinner'] });
  await openPlan();
  await fireEvent.press(screen.getByRole('button', { name: 'Suggest meals' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Browse dinner' }));
  await fireEvent.press(await screen.findByRole('button', { name: /^Turkey chilli with rice, / }));
  await screen.findByRole('button', { name: 'Dinner: Turkey chilli with rice' });
  await fireEvent.press(screen.getByRole('button', { name: 'Meal prep' }));
  await screen.findByRole('header', { name: 'Meal prep' });
  expect(await screen.findByRole('checkbox', { name: '1. Make Turkey chilli with rice' })).toBeTruthy();
  expect(screen.getByText(/in all, following the recipe/)).toBeTruthy();
  void planDayKeys;
});
