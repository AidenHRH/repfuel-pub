import { logLoggable } from '@/database/repositories/foodLogRepository';
import { basket } from '@/features/nutrition/basket';
import { logAndAnnounce, nutritionEvents } from '@/features/nutrition/events';

import { migratedDb, seedRegulars } from '../helpers/seed';

jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(async () => undefined), ImpactFeedbackStyle: { Light: 'light' } }));

afterEach(() => basket.close());

test('while the basket is open, logging saves the entry and adds it to the basket without announcing it', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  const events: string[] = [];
  const stop = nutritionEvents.subscribe((e) => events.push(e.type));
  basket.open('breakfast');
  const entry = await logAndAnnounce(db, { kind: 'recipe', id: overnightOats.id }, 1, 'breakfast');
  stop();
  expect(basket.items().map((e) => e.id)).toEqual([entry.id]);
  expect(events).toEqual(['changed']);
});

test('closed, logging announces the entry as before', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  const events: string[] = [];
  const stop = nutritionEvents.subscribe((e) => events.push(e.type));
  await logAndAnnounce(db, { kind: 'recipe', id: overnightOats.id }, 1, 'breakfast');
  stop();
  expect(basket.isOpen()).toBe(false);
  expect(events).toEqual(['changed', 'logged']);
});

test('remove takes an item out; close empties the basket and tells listeners', async () => {
  const db = await migratedDb();
  const { overnightOats } = await seedRegulars(db);
  basket.open('lunch');
  const seen: number[] = [];
  const stop = basket.subscribe(() => seen.push(basket.items().length));
  const a = await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1);
  basket.add(a);
  basket.remove(a.id);
  basket.close();
  stop();
  expect(seen).toEqual([1, 0, 0]);
  expect(basket.items()).toEqual([]);
});
