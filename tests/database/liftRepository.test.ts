import {
  allRecords,
  deleteLift,
  getLift,
  lastSession,
  logLift,
  recentLifts,
  updateLift,
} from '@/database/repositories/liftRepository';

import { migratedDb } from '../helpers/seed';

const BENCH = 'ex_barbell_bench_press';
const PUSHUP = 'ex_push_up';
const at = (iso: string) => new Date(iso);
const sets = (...pairs: [number | null, number, number?][]) =>
  pairs.map(([weightKg, reps, effort]) => ({ weightKg, reps, effort: effort ?? null }));

test('a logged lift shows in recent lifts with its sets', async () => {
  const db = await migratedDb();
  const { workoutId, records } = await logLift(db, {
    exerciseId: BENCH,
    at: at('2026-10-20T18:00:00Z'),
    sets: sets([80, 8, 8], [80, 7, 9]),
  });
  expect(records).toEqual([]);
  const [lift] = await recentLifts(db);
  expect(lift).toMatchObject({
    workoutId,
    exerciseId: BENCH,
    exerciseName: 'Barbell bench press',
    at: '2026-10-20T18:00:00.000Z',
  });
  expect(lift.sets).toEqual(sets([80, 8, 8], [80, 7, 9]));
});

test('beating a previous best returns the PR', async () => {
  const db = await migratedDb();
  await logLift(db, { exerciseId: BENCH, at: at('2026-10-20T18:00:00Z'), sets: sets([80, 8]) });
  const { records } = await logLift(db, { exerciseId: BENCH, at: at('2026-10-22T18:00:00Z'), sets: sets([85, 5]) });
  expect(records.map((r) => r.label)).toContain('Heaviest ever: 85 kg (was 80 kg)');
});

test('lowering a lift’s weight removes the record it set; deleting restores the old one', async () => {
  const db = await migratedDb();
  await logLift(db, { exerciseId: BENCH, at: at('2026-10-20T18:00:00Z'), sets: sets([80, 8]) });
  const { workoutId } = await logLift(db, { exerciseId: BENCH, at: at('2026-10-22T18:00:00Z'), sets: sets([85, 5]) });
  const heaviest = async () => (await allRecords(db)).find((r) => r.exercise.id === BENCH)?.records.heaviest?.weightKg;

  expect(await heaviest()).toBe(85);
  await updateLift(db, workoutId, { exerciseId: BENCH, at: at('2026-10-22T18:00:00Z'), sets: sets([75, 10]) });
  expect(await heaviest()).toBe(80);
  await deleteLift(db, workoutId);
  expect(await heaviest()).toBe(80);
  expect(await getLift(db, workoutId)).toBeNull();
});

test('last session is the most recent earlier lift of that exercise', async () => {
  const db = await migratedDb();
  await logLift(db, { exerciseId: BENCH, at: at('2026-10-18T18:00:00Z'), sets: sets([77.5, 8]) });
  await logLift(db, { exerciseId: BENCH, at: at('2026-10-20T18:00:00Z'), sets: sets([80, 6, 8], [80, 6, 9]) });
  await logLift(db, { exerciseId: PUSHUP, at: at('2026-10-21T18:00:00Z'), sets: sets([null, 20]) });
  expect(await lastSession(db, BENCH)).toMatchObject({ at: '2026-10-20T18:00:00.000Z', sets: sets([80, 6, 8], [80, 6, 9]) });
  expect(await lastSession(db, BENCH, at('2026-10-19T00:00:00Z'))).toMatchObject({ sets: sets([77.5, 8]) });
  expect(await lastSession(db, 'ex_cable_fly')).toBeNull();
});

test('bodyweight lifts track most reps', async () => {
  const db = await migratedDb();
  await logLift(db, { exerciseId: PUSHUP, at: at('2026-10-20T18:00:00Z'), sets: sets([null, 20]) });
  const { records } = await logLift(db, { exerciseId: PUSHUP, at: at('2026-10-22T18:00:00Z'), sets: sets([null, 25]) });
  expect(records.map((r) => r.label)).toEqual(['Most reps: 25 (was 20)']);
});

test.each([
  ['no sets', []],
  ['zero reps', sets([80, 0])],
  ['fractional reps', sets([80, 7.5])],
  ['effort above 10', sets([80, 8, 11])],
  ['negative weight', sets([-5, 8])],
])('rejects %s', async (_label, bad) => {
  const db = await migratedDb();
  await expect(logLift(db, { exerciseId: BENCH, at: at('2026-10-20T18:00:00Z'), sets: bad })).rejects.toThrow(RangeError);
  expect(await recentLifts(db)).toEqual([]);
});

describe('timed sets', () => {
  const plank = 'ex_plank';

  test('a timed set is saved and read back with its time', async () => {
    const db = await migratedDb();
    const { workoutId } = await logLift(db, {
      exerciseId: plank,
      at: new Date('2026-10-22T18:00:00Z'),
      sets: [{ weightKg: null, reps: null, effort: 7, durationSeconds: 90 }],
    });
    expect((await getLift(db, workoutId))!.sets).toEqual([{ weightKg: null, reps: null, effort: 7, durationSeconds: 90 }]);
  });

  test('a longer hold is reported as a record', async () => {
    const db = await migratedDb();
    await logLift(db, {
      exerciseId: plank,
      at: new Date('2026-10-20T18:00:00Z'),
      sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: 85 }],
    });
    const { records } = await logLift(db, {
      exerciseId: plank,
      at: new Date('2026-10-22T18:00:00Z'),
      sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: 90 }],
    });
    expect(records.map((r) => r.type)).toEqual(['longest_hold']);
  });

  test('a set needs reps or a time, not both and not neither', async () => {
    const db = await migratedDb();
    const at = new Date('2026-10-22T18:00:00Z');
    await expect(
      logLift(db, { exerciseId: plank, at, sets: [{ weightKg: null, reps: 5, effort: null, durationSeconds: 30 }] }),
    ).rejects.toThrow(RangeError);
    await expect(
      logLift(db, { exerciseId: plank, at, sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: null }] }),
    ).rejects.toThrow(RangeError);
    await expect(
      logLift(db, { exerciseId: plank, at, sets: [{ weightKg: null, reps: null, effort: null, durationSeconds: 4000 }] }),
    ).rejects.toThrow(RangeError);
  });
});

test('helped reps are kept with the set; impossible ones are refused', async () => {
  const db = await migratedDb();
  const at = new Date('2026-10-23T18:00:00Z');
  const { workoutId } = await logLift(db, {
    exerciseId: 'ex_barbell_bench_press',
    at,
    sets: [
      { weightKg: 100, reps: 6, effort: 10, assistedReps: 2 },
      { weightKg: 100, reps: 5, effort: 9 },
    ],
  });
  expect((await getLift(db, workoutId))!.sets).toEqual([
    { weightKg: 100, reps: 6, effort: 10, assistedReps: 2 },
    { weightKg: 100, reps: 5, effort: 9 },
  ]);
  const bad = (assistedReps: number) =>
    logLift(db, { exerciseId: 'ex_barbell_bench_press', at, sets: [{ weightKg: 100, reps: 3, effort: null, assistedReps }] });
  await expect(bad(4)).rejects.toThrow(RangeError);
  await expect(bad(1.5)).rejects.toThrow(RangeError);
});
