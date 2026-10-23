import { runMigrations } from '@/database/migrate';
import { allMigrations, type Migration } from '@/database/migrations';

const LATEST = allMigrations[allMigrations.length - 1].version;

import { createTestDb } from '../helpers/testDb';

const TABLES = [
  'user_profile',
  'nutrition_targets',
  'app_settings',
  'food_product',
  'recipe',
  'recipe_ingredient',
  'food_log_entry',
  'exercise',
  'workout_template',
  'template_exercise',
  'workout',
  'workout_exercise',
  'workout_set',
  'personal_record',
  'body_measurement',
];

async function tableNames(db: ReturnType<typeof createTestDb>) {
  const rows = await db.getAll<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'");
  return rows.map((r) => r.name);
}

describe('runMigrations', () => {
  test('creates every table on a fresh database and reports the schema version', async () => {
    const db = createTestDb();
    expect(await runMigrations(db)).toBe(LATEST);
    expect(await tableNames(db)).toEqual(expect.arrayContaining(TABLES));
  });

  test('running again on restart changes nothing and keeps existing rows', async () => {
    const db = createTestDb();
    await runMigrations(db);
    await db.run('UPDATE user_profile SET age = 29');

    expect(await runMigrations(db)).toBe(LATEST);
    const profiles = await db.getAll<{ age: number }>('SELECT age FROM user_profile');
    expect(profiles).toEqual([{ age: 29 }]);
    const targets = await db.getAll('SELECT id FROM nutrition_targets');
    expect(targets).toHaveLength(1);
  });

  test('a failing migration rolls back and leaves the version unchanged', async () => {
    const db = createTestDb();
    await runMigrations(db);
    const broken: Migration = {
      version: LATEST + 1,
      name: 'broken',
      async up(d) {
        await d.exec('CREATE TABLE half_done (id TEXT)');
        throw new Error('boom');
      },
    };
    await expect(runMigrations(db, [...allMigrations, broken])).rejects.toThrow('boom');
    expect((await db.getFirst<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(LATEST);
    expect(await tableNames(db)).not.toContain('half_done');
  });
});

describe('schema constraints', () => {
  async function migrated() {
    const db = createTestDb();
    await runMigrations(db);
    return db;
  }

  const now = '2026-10-21T12:00:00.000Z';

  test('rejects an unknown meal category', async () => {
    const db = await migrated();
    await expect(
      db.run(
        `INSERT INTO food_log_entry (id, food_name_snapshot, amount, unit, is_approximate, logged_at, local_day, meal_category, created_at, updated_at)
         VALUES ('e1', 'Oats', 1, 'serving', 0, ?, '2026-10-21', 'brunch', ?, ?)`,
        [now, now, now],
      ),
    ).rejects.toThrow(/CHECK/);
  });

  test('rejects an effort rating outside 1–10', async () => {
    const db = await migrated();
    await db.run(`INSERT INTO workout (id, name, started_at, created_at, updated_at) VALUES ('w1', 'Push A', ?, ?, ?)`, [
      now,
      now,
      now,
    ]);
    await db.run(
      `INSERT INTO exercise (id, name, muscle_group, equipment, is_custom, created_at) VALUES ('x1', 'Bench press', 'chest', 'barbell', 0, ?)`,
      [now],
    );
    await db.run(`INSERT INTO workout_exercise (id, workout_id, exercise_id, sort_order) VALUES ('we1', 'w1', 'x1', 0)`);
    await expect(
      db.run(
        `INSERT INTO workout_set (id, workout_exercise_id, set_number, weight_kg, repetitions, effort, is_completed) VALUES ('s1', 'we1', 1, 60, 8, 11, 1)`,
      ),
    ).rejects.toThrow(/CHECK/);
  });

  test('deleting a food keeps the log entry and its snapshot', async () => {
    const db = await migrated();
    await db.run(
      `INSERT INTO food_product (id, name, basis, serving_size, serving_unit, kcal, protein_g, data_source, is_favourite, created_at, updated_at)
       VALUES ('f1', 'Whey', 'per_serving', 30, 'g', 120, 24, 'manual', 0, ?, ?)`,
      [now, now],
    );
    await db.run(
      `INSERT INTO food_log_entry (id, food_product_id, food_name_snapshot, amount, unit, kcal, protein_g, is_approximate, logged_at, local_day, meal_category, created_at, updated_at)
       VALUES ('e1', 'f1', 'Whey', 1, 'serving', 120, 24, 0, ?, '2026-10-21', 'snack', ?, ?)`,
      [now, now, now],
    );

    await db.run(`DELETE FROM food_product WHERE id = 'f1'`);

    const entry = await db.getFirst<{ food_product_id: string | null; protein_g: number; food_name_snapshot: string }>(
      `SELECT food_product_id, protein_g, food_name_snapshot FROM food_log_entry WHERE id = 'e1'`,
    );
    expect(entry).toEqual({ food_product_id: null, protein_g: 24, food_name_snapshot: 'Whey' });
  });

  test('unknown nutrients are stored as NULL, not zero', async () => {
    const db = await migrated();
    await db.run(
      `INSERT INTO food_product (id, name, basis, serving_size, serving_unit, kcal, protein_g, data_source, is_favourite, created_at, updated_at)
       VALUES ('f2', 'Mystery bar', 'per_100g', NULL, NULL, 400, NULL, 'manual', 0, ?, ?)`,
      [now, now],
    );
    const row = await db.getFirst<{ protein_g: number | null; fat_g: number | null }>(
      `SELECT protein_g, fat_g FROM food_product WHERE id = 'f2'`,
    );
    expect(row).toEqual({ protein_g: null, fat_g: null });
  });
});
