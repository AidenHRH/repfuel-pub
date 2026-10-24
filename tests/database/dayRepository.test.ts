import { daySummaries, logAgain, setSkipped, skippedMeals } from '@/database/repositories/dayRepository';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { migratedDb, seedRegulars } from '../helpers/seed';

test('a day’s summary: its entries, the targets in effect then, skipped meals and its stage', async () => {
  const db = await migratedDb();
  const food = (await seedRegulars(db)).foods.oats;
  await logLoggable(db, { kind: 'food', id: food.id }, 1, new Date('2026-10-20T08:00:00'), 'breakfast');
  await setSkipped(db, '2026-10-20', 'lunch', true);
  expect(await skippedMeals(db, '2026-10-20')).toEqual(['lunch']);

  const [mon, tue] = await daySummaries(db, ['2026-10-20', '2026-10-21']);
  expect(mon.entries).toHaveLength(1);
  expect(mon.skipped).toEqual(['lunch']);
  expect(mon.status).toEqual({ stage: 'partial', mealsDone: 2 });
  expect(mon.targets.caloriesKcal).toBeGreaterThan(0);
  expect(tue.status.stage).toBe('empty');

  await setSkipped(db, '2026-10-20', 'lunch', false);
  expect(await skippedMeals(db, '2026-10-20')).toEqual([]);
});

test('log again copies an entry, same amounts, into today’s chosen meal', async () => {
  const db = await migratedDb();
  const food = (await seedRegulars(db)).foods.oats;
  const original = await logLoggable(db, { kind: 'food', id: food.id }, 1.5, new Date('2026-10-20T12:30:00'), 'lunch');
  const now = new Date('2026-10-22T19:00:00');
  const copy = await logAgain(db, original.id, 'dinner', now);
  expect(copy).toMatchObject({
    foodId: food.id,
    amount: 1.5,
    nutrients: original.nutrients,
    mealCategory: 'dinner',
    localDay: '2026-10-22',
  });
  expect(copy.id).not.toBe(original.id);
  expect((await entriesForDay(db, '2026-10-22')).map((e) => e.mealCategory)).toEqual(['dinner']);
  expect(await entriesForDay(db, '2026-10-20')).toHaveLength(1);
});
