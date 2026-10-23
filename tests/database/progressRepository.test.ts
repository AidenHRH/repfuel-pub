import { logClass, listClassTypes } from '@/database/repositories/classRepository';
import { listExercises } from '@/database/repositories/exerciseRepository';
import { logLift } from '@/database/repositories/liftRepository';
import { allLiftSets, classEfforts } from '@/database/repositories/progressRepository';

import { migratedDb } from '../helpers/seed';

test('reads every set with its exercise and muscle, and class efforts', async () => {
  const db = await migratedDb();
  const bench = (await listExercises(db, { search: 'bench press' }))[0];
  await logLift(db, {
    exerciseId: bench.id,
    at: new Date('2026-10-20T18:00:00Z'),
    sets: [
      { weightKg: 80, reps: 8, effort: 8 },
      { weightKg: 80, reps: 7, effort: 9, assistedReps: 1 },
    ],
  });
  const [type] = await listClassTypes(db);
  await logClass(db, { classTypeId: type.id, at: new Date('2026-10-21T18:00:00Z'), durationMin: 45, effort: 7, notes: null });

  const sets = await allLiftSets(db);
  expect(sets).toHaveLength(2);
  expect(sets[0]).toMatchObject({
    exerciseId: bench.id,
    exerciseName: bench.name,
    muscleGroup: bench.muscleGroup,
    weightKg: 80,
    reps: 8,
    effort: 8,
  });
  expect(sets[1].assistedReps).toBe(1);
  expect(await classEfforts(db)).toEqual([{ at: '2026-10-21T18:00:00.000Z', effort: 7 }]);
});
