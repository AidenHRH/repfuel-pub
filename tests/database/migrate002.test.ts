import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';

import { createTestDb } from '../helpers/testDb';

const now = '2026-10-21T12:00:00.000Z';

async function v1WithIngredient() {
  const db = createTestDb();
  await runMigrations(
    db,
    allMigrations.filter((m) => m.version === 1),
  );
  await db.run(
    `INSERT INTO food_product (id, name, basis, kcal, protein_g, data_source, is_favourite, created_at, updated_at)
     VALUES ('oats', 'Oats', 'per_100g', 379, 13.2, 'manual', 0, ?, ?)`,
    [now, now],
  );
  await db.run(`INSERT INTO recipe (id, name, portions_made, created_at, updated_at) VALUES ('r1', 'Oats', 1, ?, ?)`, [now, now]);
  await db.run(`INSERT INTO recipe (id, name, portions_made, created_at, updated_at) VALUES ('pico', 'Pico', 4, ?, ?)`, [
    now,
    now,
  ]);
  await db.run(
    `INSERT INTO recipe_ingredient (id, recipe_id, food_product_id, amount, unit, sort_order) VALUES ('i1', 'r1', 'oats', 50, 'g', 0)`,
  );
  return db;
}

test('upgrading from version 1 keeps existing recipe ingredients', async () => {
  const db = await v1WithIngredient();
  expect(await runMigrations(db)).toBe(allMigrations[allMigrations.length - 1].version);
  expect(await db.getAll('SELECT id, recipe_id, food_product_id, sub_recipe_id, amount, unit FROM recipe_ingredient')).toEqual([
    { id: 'i1', recipe_id: 'r1', food_product_id: 'oats', sub_recipe_id: null, amount: 50, unit: 'g' },
  ]);
});

test('an ingredient can be a portion of another recipe', async () => {
  const db = await v1WithIngredient();
  await runMigrations(db);
  await db.run(
    `INSERT INTO recipe_ingredient (id, recipe_id, sub_recipe_id, amount, unit, sort_order) VALUES ('i2', 'r1', 'pico', 0.5, 'portion', 1)`,
  );
  expect(await db.getAll(`SELECT id FROM recipe_ingredient WHERE sub_recipe_id = 'pico'`)).toEqual([{ id: 'i2' }]);
});

test.each([
  ['both a food and a recipe', `'oats', 'pico', 1, 'portion'`],
  ['neither a food nor a recipe', `NULL, NULL, 1, 'g'`],
  ['a recipe measured in grams', `NULL, 'pico', 100, 'g'`],
])('rejects an ingredient that is %s', async (_label, values) => {
  const db = await v1WithIngredient();
  await runMigrations(db);
  await expect(
    db.run(
      `INSERT INTO recipe_ingredient (id, recipe_id, food_product_id, sub_recipe_id, amount, unit, sort_order) VALUES ('bad', 'r1', ${values}, 9)`,
    ),
  ).rejects.toThrow(/CHECK/);
});

test('deleting a recipe removes its own ingredient rows', async () => {
  const db = await v1WithIngredient();
  await runMigrations(db);
  await db.run(`DELETE FROM recipe WHERE id = 'r1'`);
  expect(await db.getAll(`SELECT id FROM recipe_ingredient`)).toEqual([]);
});
