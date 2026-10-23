import { runMigrations } from '@/database/migrate';
import { allMigrations } from '@/database/migrations';
import {
  createExercise,
  getExercise,
  listExercises,
  recentExercises,
  setExerciseVideo,
} from '@/database/repositories/exerciseRepository';
import { logLift } from '@/database/repositories/liftRepository';
import { exerciseId } from '@/database/seed/exercises';

import { createTestDb } from '../helpers/testDb';
import { migratedDb } from '../helpers/seed';

test('the starter library covers every muscle group', async () => {
  const db = await migratedDb();
  const all = await listExercises(db, {});
  const groups = new Set(all.map((e) => e.muscleGroup));
  expect([...groups].sort()).toEqual(['back', 'biceps', 'chest', 'core', 'full_body', 'legs', 'shoulders', 'triceps']);
  expect(all.length).toBeGreaterThanOrEqual(80);
});

test('includes the owner’s examples', async () => {
  const db = await migratedDb();
  const chest = (await listExercises(db, { group: 'chest' })).map((e) => e.name);
  expect(chest).toEqual(expect.arrayContaining(['Cable fly', 'Barbell bench press']));
  const biceps = (await listExercises(db, { group: 'biceps' })).map((e) => e.name);
  expect(biceps).toEqual(expect.arrayContaining(['EZ-bar curl', 'Barbell curl', 'Dumbbell curl']));
});

test('search ignores case and matches within names', async () => {
  const db = await migratedDb();
  const names = (await listExercises(db, { search: 'CURL' })).map((e) => e.name);
  expect(names).toEqual(expect.arrayContaining(['EZ-bar curl', 'Hammer curl']));
  expect(names.every((n) => n.toLowerCase().includes('curl'))).toBe(true);
});

test('bodyweight exercises are marked', async () => {
  const db = await migratedDb();
  expect(await getExercise(db, 'ex_push_up')).toMatchObject({ name: 'Push-up', isBodyweight: true, isCustom: false });
});

test('custom exercises can be added once', async () => {
  const db = await migratedDb();
  const made = await createExercise(db, {
    name: 'Landmine press',
    muscleGroup: 'shoulders',
    equipment: 'barbell',
    isBodyweight: false,
  });
  expect(made).toMatchObject({ name: 'Landmine press', isCustom: true });
  await expect(
    createExercise(db, { name: 'landmine PRESS', muscleGroup: 'shoulders', equipment: 'barbell', isBodyweight: false }),
  ).rejects.toThrow(/already/);
  await expect(
    createExercise(db, { name: 'cable fly', muscleGroup: 'chest', equipment: 'cable', isBodyweight: false }),
  ).rejects.toThrow(/already/);
});

test('upgrading a version 3 database adds the library and keeps existing data', async () => {
  const db = createTestDb();
  await runMigrations(
    db,
    allMigrations.filter((m) => m.version <= 3),
  );
  await db.run(`UPDATE user_profile SET age = 30`);
  await runMigrations(db);
  expect((await db.getFirst<{ age: number }>('SELECT age FROM user_profile'))?.age).toBe(30);
  expect((await listExercises(db, {})).length).toBeGreaterThanOrEqual(80);
});

test('the library knows which exercises are reps only or timed', async () => {
  const db = await migratedDb();
  expect((await getExercise(db, exerciseId('Ab wheel rollout')))!.tracking).toBe('reps');
  expect((await getExercise(db, exerciseId('Push-up')))!.tracking).toBe('reps');
  expect((await getExercise(db, exerciseId('Plank')))!.tracking).toBe('time');
  expect((await getExercise(db, exerciseId('Barbell bench press')))!.tracking).toBe('weight_reps');
});

test('a custom exercise keeps its kind', async () => {
  const db = await migratedDb();
  const made = await createExercise(db, {
    name: 'Wall sit',
    muscleGroup: 'legs',
    equipment: 'bodyweight',
    isBodyweight: true,
    tracking: 'time',
  });
  expect(made.tracking).toBe('time');
  const plain = await createExercise(db, {
    name: 'Landmine row',
    muscleGroup: 'back',
    equipment: 'barbell',
    isBodyweight: false,
  });
  expect(plain.tracking).toBe('weight_reps');
});

test('recent exercises: the latest logged first, once each', async () => {
  const db = await migratedDb();
  const bench = exerciseId('Barbell bench press');
  const plank = exerciseId('Plank');
  await logLift(db, { exerciseId: bench, at: new Date('2026-10-20T18:00:00Z'), sets: [{ weightKg: 80, reps: 5, effort: null }] });
  await logLift(db, {
    exerciseId: plank,
    at: new Date('2026-10-21T18:00:00Z'),
    sets: [{ weightKg: null, reps: 1, effort: null }],
  });
  await logLift(db, { exerciseId: bench, at: new Date('2026-10-22T18:00:00Z'), sets: [{ weightKg: 85, reps: 3, effort: null }] });
  expect((await recentExercises(db)).map((e) => e.id)).toEqual([bench, plank]);
  expect(await recentExercises(db, 1)).toHaveLength(1);
});

test('class types are ready to use', async () => {
  const db = await migratedDb();
  const rows = await db.getAll<{ id: string; name: string }>('SELECT id, name FROM class_type ORDER BY id');
  expect(rows.map((r) => r.name).sort()).toEqual(['HIIT', 'Hyrox', 'Run', 'Spin']);
});

test('a video link per exercise: saved, read back, cleared; only YouTube links', async () => {
  const db = await migratedDb();
  expect((await getExercise(db, 'ex_barbell_bench_press'))!.videoUrl).toBeNull();
  await setExerciseVideo(db, 'ex_barbell_bench_press', 'https://youtu.be/dQw4w9WgXcQ?si=x');
  expect((await getExercise(db, 'ex_barbell_bench_press'))!.videoUrl).toBe('https://youtu.be/dQw4w9WgXcQ?si=x');
  await setExerciseVideo(db, 'ex_barbell_bench_press', null);
  expect((await getExercise(db, 'ex_barbell_bench_press'))!.videoUrl).toBeNull();
  await expect(setExerciseVideo(db, 'ex_barbell_bench_press', 'https://vimeo.com/1')).rejects.toThrow(RangeError);
});
