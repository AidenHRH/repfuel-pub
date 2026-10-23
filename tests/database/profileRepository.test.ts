import { runMigrations } from '@/database/migrate';
import { getProfile, updateProfile } from '@/database/repositories/profileRepository';
import { getCurrentTargets, setTargets } from '@/database/repositories/targetsRepository';

import { createTestDb } from '../helpers/testDb';

async function migrated() {
  const db = createTestDb();
  await runMigrations(db);
  return db;
}

describe('profile', () => {
  test('starts with placeholder values until the welcome setup', async () => {
    const db = await migrated();
    expect(await getProfile(db)).toMatchObject({
      age: 30,
      heightCm: 175,
      currentWeightKg: 75,
      bodyFatPercentage: null,
      primaryGoal: 'Not set yet',
    });
  });

  test('updates persist and bump updatedAt', async () => {
    const db = await migrated();
    const before = await getProfile(db);
    const after = await updateProfile(db, { currentWeightKg: 71.2 });
    expect(after.currentWeightKg).toBe(71.2);
    expect(after.age).toBe(30);
    expect((await getProfile(db)).currentWeightKg).toBe(71.2);
    expect(after.updatedAt >= before.updatedAt).toBe(true);
  });
});

describe('nutrition targets', () => {
  test('start at 2,500 kcal and 145 g protein with carbs and fat unset', async () => {
    const db = await migrated();
    expect(await getCurrentTargets(db)).toMatchObject({
      caloriesKcal: 2500,
      proteinGrams: 145,
      carbohydratesGrams: null,
      fatGrams: null,
    });
  });

  test('changing targets adds a new row and keeps the old one for history', async () => {
    const db = await migrated();
    const later = new Date(Date.now() + 60_000);
    await setTargets(db, {
      caloriesKcal: 2300,
      proteinGrams: 150,
      carbohydratesGrams: null,
      fatGrams: null,
      effectiveFrom: later.toISOString(),
    });

    expect(await getCurrentTargets(db, new Date(later.getTime() + 1))).toMatchObject({ caloriesKcal: 2300, proteinGrams: 150 });
    const rows = await db.getAll('SELECT id FROM nutrition_targets');
    expect(rows).toHaveLength(2);
  });

  test('targets dated in the future are not current yet', async () => {
    const db = await migrated();
    await setTargets(db, {
      caloriesKcal: 2300,
      proteinGrams: 150,
      carbohydratesGrams: null,
      fatGrams: null,
      effectiveFrom: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(await getCurrentTargets(db)).toMatchObject({ caloriesKcal: 2500, proteinGrams: 145 });
  });

  test('effective dates must be full ISO timestamps so they sort correctly', async () => {
    const db = await migrated();
    await expect(
      setTargets(db, { caloriesKcal: 2300, proteinGrams: 150, carbohydratesGrams: null, fatGrams: null, effectiveFrom: '2026-10-21' }),
    ).rejects.toThrow(/CHECK/);
  });
});
