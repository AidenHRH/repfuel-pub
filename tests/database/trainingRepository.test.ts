import { logClass } from '@/database/repositories/classRepository';
import { logLift } from '@/database/repositories/liftRepository';
import { trainingFeed } from '@/database/repositories/trainingRepository';

import { migratedDb } from '../helpers/seed';

test('lifts and classes in one feed, newest first, with PRs marked', async () => {
  const db = await migratedDb();
  const bench = 'ex_barbell_bench_press';
  await logLift(db, { exerciseId: bench, at: new Date('2026-10-15T18:00:00Z'), sets: [{ weightKg: 87.5, reps: 2, effort: 8 }] });
  await logClass(db, {
    classTypeId: 'class_hyrox',
    at: new Date('2026-10-20T17:30:00Z'),
    durationMin: 60,
    effort: 9,
    notes: null,
  });
  await logLift(db, { exerciseId: bench, at: new Date('2026-10-22T17:05:00Z'), sets: [{ weightKg: 90, reps: 1, effort: 8 }] });
  await logLift(db, { exerciseId: bench, at: new Date('2026-10-22T17:30:00Z'), sets: [{ weightKg: 70, reps: 5, effort: 7 }] });

  const feed = await trainingFeed(db);
  expect(feed.map((i) => (i.kind === 'lift' ? `${i.lift.exerciseName}${i.isPr ? ' PR' : ''}` : i.session.className))).toEqual([
    'Barbell bench press',
    'Barbell bench press PR',
    'Hyrox',
    // The first time is a baseline, not a record.
    'Barbell bench press',
  ]);
});

test('the feed is limited to the most recent items', async () => {
  const db = await migratedDb();
  for (let i = 1; i <= 5; i++) {
    await logClass(db, {
      classTypeId: 'class_run',
      at: new Date(`2026-10-0${i}T07:00:00Z`),
      durationMin: 30,
      effort: 5,
      notes: null,
    });
  }
  expect(await trainingFeed(db, 3)).toHaveLength(3);
});
