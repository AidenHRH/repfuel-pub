import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';
import { createFood, getFood } from '@/database/repositories/foodRepository';

import { createTestDb } from '../helpers/testDb';

test('foods saved before 0.13 keep everything, with the pack size unknown', async () => {
  const db = createTestDb();
  await runMigrations(
    db,
    allMigrations.filter((m) => m.version <= 12),
  );
  await db.run(
    `INSERT INTO food_product (id, name, basis, serving_size, kcal, protein_g, data_source, is_favourite, created_at, updated_at)
     VALUES ('pasta', 'Fusilli', 'per_100g', 75, 359, 12, 'open_food_facts', 1, '2026-10-01', '2026-10-01')`,
  );
  await runMigrations(db, allMigrations);
  expect(await getFood(db, 'pasta')).toMatchObject({ name: 'Fusilli', servingSize: 75, isFavourite: true, packSize: null });
  const fresh = await createFood(db, {
    name: 'Tuna',
    brand: null,
    barcode: null,
    basis: 'per_100g',
    servingSize: 110,
    servingUnit: 'g',
    packSize: 145,
    nutrients: { kcal: 109, proteinG: 25, carbsG: 0, fatG: 1, fibreG: 0 },
    dataSource: 'manual',
    notes: null,
  });
  expect((await getFood(db, fresh.id))!.packSize).toBe(145);
});
