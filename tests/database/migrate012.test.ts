import { exportBackup, restoreBackup } from '@/database/backup';
import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';
import { entriesForDay, logLoggable } from '@/database/repositories/foodLogRepository';
import { createFood } from '@/database/repositories/foodRepository';
import { drinkItems, setInSnacksRow, snackItems } from '@/database/repositories/snackRepository';

import { createTestDb } from '../helpers/testDb';
import { migratedDb, seedRegulars } from '../helpers/seed';

const at = new Date('2026-10-22T12:00:00Z');

async function v11() {
  const db = createTestDb();
  await runMigrations(
    db,
    allMigrations.filter((m) => m.version <= 11),
  );
  return db;
}

const food = (name: string, basis: 'per_serving' | 'per_100ml') => ({
  name,
  brand: null,
  barcode: null,
  basis,
  servingSize: null,
  servingUnit: null,
  nutrients: { kcal: 100, proteinG: 5, carbsG: null, fatG: null, fibreG: null },
  dataSource: 'manual' as const,
  notes: null,
});

test('upgrading keeps every diary entry and then accepts drinks', async () => {
  const db = await v11();
  const { overnightOats } = await seedRegulars(db);
  const logged = [];
  for (const meal of ['breakfast', 'lunch', 'dinner', 'snack'] as const) {
    logged.push(await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at, meal));
  }
  await runMigrations(db);
  const after = await entriesForDay(db, '2026-10-22');
  expect(after.map((e) => [e.id, e.mealCategory, e.nutrients.kcal])).toEqual(
    logged.map((e) => [e.id, e.mealCategory, e.nutrients.kcal]),
  );
  const drink = await logLoggable(db, { kind: 'recipe', id: overnightOats.id }, 1, at, 'drink');
  expect(drink.mealCategory).toBe('drink');
  expect(
    await db.getFirst<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_food_log_entry_day'",
    ),
  ).toBeTruthy();
});

test('the old Snacks & drinks row is split: drinks by volume go to Drinks', async () => {
  const db = await v11();
  const latte = await createFood(db, food('Oat latte', 'per_100ml'));
  const bar = await createFood(db, food('Protein bar', 'per_serving'));
  await setInSnacksRow(db, latte.id, true);
  await setInSnacksRow(db, bar.id, true);
  await runMigrations(db);
  expect((await snackItems(db, at)).map((i) => i.name)).toEqual(['Protein bar']);
  expect((await drinkItems(db, at)).map((i) => i.name)).toEqual(['Oat latte']);
});

test('a backup from before drinks restores', async () => {
  const old = await v11();
  const { overnightOats } = await seedRegulars(old);
  await logLoggable(old, { kind: 'recipe', id: overnightOats.id }, 1, at, 'snack');
  const db = await migratedDb();
  await restoreBackup(db, await exportBackup(old));
  expect(await entriesForDay(db, '2026-10-22')).toHaveLength(1);
});
