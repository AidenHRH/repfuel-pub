import { runMigrations } from '@/database/migrate';
import { getProfile } from '@/database/repositories/profileRepository';
import { createRecipe } from '@/database/repositories/recipeRepository';
import { completeSetup, getSetup } from '@/database/repositories/setupRepository';
import { getCurrentTargets } from '@/database/repositories/targetsRepository';
import { setupDone } from '@/database/migrations/018_setup_done';

import { createTestDb } from '../helpers/testDb';

test('a new install has not been set up', async () => {
  const db = createTestDb();
  await runMigrations(db);
  expect(await getSetup(db)).toEqual({ done: false });
});

test('a phone with meals from before the welcome counts as set up', async () => {
  const db = createTestDb();
  await runMigrations(db);
  await createRecipe(db, { name: 'Oats', portionsMade: 1, ingredients: [] });
  await setupDone.up(db);
  expect((await getSetup(db)).done).toBe(true);
});

test('completing the setup saves the profile, targets from now and the answers', async () => {
  const db = createTestDb();
  await runMigrations(db);
  const now = new Date(Date.now() + 1000);
  await completeSetup(
    db,
    { age: 34, heightCm: 180, weightKg: 82, sex: 'female', activity: 'light', goal: 'lose', bodyFatPercentage: null },
    { kcal: 1900, proteinG: 140 },
    now,
  );
  const profile = await getProfile(db);
  expect(profile).toMatchObject({
    age: 34,
    heightCm: 180,
    currentWeightKg: 82,
    bodyFatPercentage: null,
    primaryGoal: 'Lose fat',
  });
  expect(await getCurrentTargets(db, new Date(now.getTime() + 1))).toMatchObject({ caloriesKcal: 1900, proteinGrams: 140 });
  expect(await getSetup(db)).toEqual({ done: true, sex: 'female', activity: 'light', goal: 'lose' });
});
