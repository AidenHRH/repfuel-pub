import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';

import { createTestDb } from '../helpers/testDb';

const now = '2026-10-22T12:00:00.000Z';

test('upgrading from version 4 keeps foods and starts with an empty snacks row', async () => {
  const db = createTestDb();
  await runMigrations(db, allMigrations.filter((m) => m.version <= 4));
  await db.run(
    `INSERT INTO food_product (id, name, basis, kcal, protein_g, data_source, is_favourite, created_at, updated_at)
     VALUES ('bar', 'Protein bar', 'per_serving', 200, 20, 'manual', 1, ?, ?)`,
    [now, now],
  );
  expect(await runMigrations(db)).toBe(allMigrations[allMigrations.length - 1].version);
  expect(await db.getAll('SELECT id, is_favourite, in_snacks_row FROM food_product')).toEqual([
    { id: 'bar', is_favourite: 1, in_snacks_row: 0 },
  ]);
  await expect(db.run(`UPDATE food_product SET in_snacks_row = 2 WHERE id = 'bar'`)).rejects.toThrow();
});
