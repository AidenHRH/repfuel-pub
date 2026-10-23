import { logClass } from '@/database/repositories/classRepository';
import { logLoggable } from '@/database/repositories/foodLogRepository';
import { logLift } from '@/database/repositories/liftRepository';
import { quickAdd } from '@/database/repositories/snackRepository';
import { getTourState, recordUse, saveTourState, tipFacts } from '@/database/repositories/tourRepository';
import { DEFAULT_TOUR_STATE } from '@/domain/tips';

import { createTestDb } from '../helpers/testDb';
import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';
import { seedRegulars } from '../helpers/seed';

async function freshDb() {
  const db = createTestDb();
  await runMigrations(db, allMigrations);
  return db;
}

test('a fresh install has not had the tour, with tips on', async () => {
  const db = await freshDb();
  expect(await getTourState(db)).toEqual(DEFAULT_TOUR_STATE);
  await saveTourState(db, { doneAt: '2026-10-23T09:00:00.000Z' });
  await saveTourState(db, { shown: ['scan'] });
  expect(await getTourState(db)).toEqual({ ...DEFAULT_TOUR_STATE, doneAt: '2026-10-23T09:00:00.000Z', shown: ['scan'] });
});

test('facts for tips: feature use, tiles, classes, effort sets and the first day of use', async () => {
  const db = await freshDb();
  const at = new Date('2026-10-01T08:00:00Z');
  expect(await tipFacts(db)).toEqual({
    usage: {},
    snackTiles: 0,
    classes: 0,
    effortSets: 0,
    creatineOn: false,
    plans: 0,
    firstUseAt: null,
  });
  await recordUse(db, 'scan', new Date('2026-10-20T10:00:00Z'));
  const { beefDinner } = await seedRegulars(db);
  await logLoggable(db, { kind: 'recipe', id: beefDinner.id }, 1, new Date('2026-10-05T18:00:00Z'));
  await logLift(db, {
    exerciseId: 'ex_barbell_bench_press',
    at,
    sets: [
      { weightKg: 90, reps: 1, effort: 8 },
      { weightKg: 80, reps: 5, effort: null },
    ],
  });
  await logClass(db, {
    classTypeId: 'class_hyrox',
    at: new Date('2026-10-10T09:00:00Z'),
    durationMin: 60,
    effort: 9,
    notes: null,
  });
  await quickAdd(db, { name: 'Protein bar', kcal: 200, proteinG: 20, mealCategory: 'snack', keepAsTile: true, at });
  expect(await tipFacts(db)).toMatchObject({
    usage: { scan: '2026-10-20T10:00:00.000Z' },
    snackTiles: 1,
    classes: 1,
    effortSets: 1,
    firstUseAt: '2026-10-01T08:00:00.000Z',
  });
});
