import type { Exercise } from '@/domain/exercises';
import { exerciseRecords, newRecords, type ExerciseRecords, type LiftSet, type RecordEvent } from '@/domain/records';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

import { getExercise, listExercises } from './exerciseRepository';

/**
 * A set: weight (null = bodyweight) × reps, or for a timed exercise a time in seconds and no reps. `assistedReps`:
 * how many of the last reps a spotter helped with.
 */
export type SetInput = {
  weightKg: number | null;
  reps: number | null;
  effort: number | null;
  durationSeconds?: number | null;
  assistedReps?: number | null;
};
export type LiftInput = { exerciseId: string; at: Date; sets: SetInput[]; notes?: string | null };
export type Lift = {
  workoutId: string;
  exerciseId: string;
  exerciseName: string;
  at: string;
  sets: SetInput[];
  notes: string | null;
};

function validate(input: LiftInput) {
  if (input.sets.length === 0) throw new RangeError('Add at least one set');
  for (const s of input.sets) {
    const timed = s.durationSeconds != null;
    if (timed === (s.reps !== null)) throw new RangeError('A set has reps or a time');
    if (timed) {
      if (!Number.isInteger(s.durationSeconds) || s.durationSeconds! < 1 || s.durationSeconds! > 3600) {
        throw new RangeError('A time must be from 1 second to 60 minutes');
      }
    } else if (!Number.isInteger(s.reps) || s.reps! < 1 || s.reps! > 100) {
      throw new RangeError('Reps must be a whole number from 1 to 100');
    }
    if (s.weightKg !== null && (!Number.isFinite(s.weightKg) || s.weightKg < 0 || s.weightKg > 1000)) {
      throw new RangeError('Weight must be between 0 and 1,000 kg');
    }
    if (
      s.assistedReps != null &&
      (timed || !Number.isInteger(s.assistedReps) || s.assistedReps < 1 || s.assistedReps > s.reps!)
    ) {
      throw new RangeError('Helped reps are some of the set’s reps');
    }
    if (s.effort !== null && (!Number.isInteger(s.effort) || s.effort < 1 || s.effort > 10)) {
      throw new RangeError('Effort is 1 to 10');
    }
  }
}

type SetRow = {
  weight_kg: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  effort: number | null;
  assisted_reps: number | null;
};

/** A stored set; `durationSeconds` only appears on timed sets, `assistedReps` only on helped ones. */
function toSet(r: SetRow): SetInput {
  const base: SetInput = { weightKg: r.weight_kg, reps: r.repetitions, effort: r.effort };
  if (r.duration_seconds !== null) base.durationSeconds = r.duration_seconds;
  if (r.assisted_reps !== null) base.assistedReps = r.assisted_reps;
  return base;
}

/** Every logged set of an exercise, for working out records. */
export async function setsForExercise(db: Db, exerciseId: string): Promise<LiftSet[]> {
  const rows = await db.getAll<SetRow & { workout_id: string; started_at: string }>(
    `SELECT w.id AS workout_id, w.started_at, s.weight_kg, s.repetitions, s.duration_seconds, s.effort, s.assisted_reps
     FROM workout_set s
     JOIN workout_exercise we ON we.id = s.workout_exercise_id
     JOIN workout w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND s.is_completed = 1 AND (s.repetitions IS NOT NULL OR s.duration_seconds IS NOT NULL)
     ORDER BY w.started_at, s.set_number`,
    [exerciseId],
  );
  return rows.map((r) => ({ workoutId: r.workout_id, at: r.started_at, ...toSet(r) }));
}

async function writeSets(db: Db, workoutId: string, input: LiftInput) {
  const workoutExerciseId = newId();
  await db.run('INSERT INTO workout_exercise (id, workout_id, exercise_id, sort_order, notes) VALUES (?, ?, ?, 0, NULL)', [
    workoutExerciseId,
    workoutId,
    input.exerciseId,
  ]);
  for (const [i, s] of input.sets.entries()) {
    await db.run(
      `INSERT INTO workout_set (id, workout_exercise_id, set_number, weight_kg, repetitions, duration_seconds, effort, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [newId(), workoutExerciseId, i + 1, s.weightKg, s.reps, s.durationSeconds ?? null, s.effort],
    );
    // Written only when helped, so the insert above stays the same as before (tests build older databases).
    if (s.assistedReps) {
      await db.run('UPDATE workout_set SET assisted_reps = ? WHERE workout_exercise_id = ? AND set_number = ?', [
        s.assistedReps,
        workoutExerciseId,
        i + 1,
      ]);
    }
  }
}

function asLiftSets(workoutId: string, input: LiftInput): LiftSet[] {
  return input.sets.map((s) => ({ workoutId, at: input.at.toISOString(), ...s }));
}

/**
 * Saves a quick lift as a real workout (one exercise, its sets) and returns any genuine new records,
 * compared with everything logged before it.
 */
export async function logLift(db: Db, input: LiftInput): Promise<{ workoutId: string; records: RecordEvent[] }> {
  validate(input);
  const exercise = await getExercise(db, input.exerciseId);
  if (!exercise) throw new Error('Exercise not found');
  const history = (await setsForExercise(db, input.exerciseId)).filter((s) => s.at < input.at.toISOString());
  const workoutId = newId();
  const now = nowIso();
  await db.transaction(async () => {
    await db.run(
      'INSERT INTO workout (id, name, started_at, completed_at, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [workoutId, exercise.name, input.at.toISOString(), input.at.toISOString(), input.notes ?? null, now, now],
    );
    await writeSets(db, workoutId, input);
  });
  return { workoutId, records: newRecords(history, asLiftSets(workoutId, input)) };
}

export async function updateLift(db: Db, workoutId: string, input: LiftInput): Promise<void> {
  validate(input);
  const exercise = await getExercise(db, input.exerciseId);
  if (!exercise) throw new Error('Exercise not found');
  await db.transaction(async () => {
    await db.run('DELETE FROM workout_exercise WHERE workout_id = ?', [workoutId]);
    await db.run('UPDATE workout SET name = ?, started_at = ?, completed_at = ?, notes = ?, updated_at = ? WHERE id = ?', [
      exercise.name,
      input.at.toISOString(),
      input.at.toISOString(),
      input.notes ?? null,
      nowIso(),
      workoutId,
    ]);
    await writeSets(db, workoutId, input);
  });
}

export async function deleteLift(db: Db, workoutId: string): Promise<void> {
  await db.run('DELETE FROM workout WHERE id = ?', [workoutId]);
}

type LiftRow = { workout_id: string; started_at: string; notes: string | null; exercise_id: string; exercise_name: string };

async function hydrate(db: Db, rows: LiftRow[]): Promise<Lift[]> {
  return Promise.all(
    rows.map(async (r) => {
      const sets = await db.getAll<SetRow>(
        `SELECT s.weight_kg, s.repetitions, s.duration_seconds, s.effort, s.assisted_reps FROM workout_set s
         JOIN workout_exercise we ON we.id = s.workout_exercise_id
         WHERE we.workout_id = ? ORDER BY s.set_number`,
        [r.workout_id],
      );
      return {
        workoutId: r.workout_id,
        exerciseId: r.exercise_id,
        exerciseName: r.exercise_name,
        at: r.started_at,
        notes: r.notes,
        sets: sets.map(toSet),
      };
    }),
  );
}

const LIFT_SELECT = `SELECT w.id AS workout_id, w.started_at, w.notes, e.id AS exercise_id, e.name AS exercise_name
  FROM workout w JOIN workout_exercise we ON we.workout_id = w.id JOIN exercise e ON e.id = we.exercise_id`;

export async function getLift(db: Db, workoutId: string): Promise<Lift | null> {
  const rows = await db.getAll<LiftRow>(`${LIFT_SELECT} WHERE w.id = ? LIMIT 1`, [workoutId]);
  return (await hydrate(db, rows))[0] ?? null;
}

export async function recentLifts(db: Db, limit = 30): Promise<Lift[]> {
  const rows = await db.getAll<LiftRow>(`${LIFT_SELECT} ORDER BY w.started_at DESC LIMIT ?`, [limit]);
  return hydrate(db, rows);
}

/** The most recent lift of this exercise before `before` (default: now), for "Last time" hints. */
export async function lastSession(db: Db, exerciseId: string, before: Date = new Date()): Promise<Lift | null> {
  const rows = await db.getAll<LiftRow>(`${LIFT_SELECT} WHERE e.id = ? AND w.started_at < ? ORDER BY w.started_at DESC LIMIT 1`, [
    exerciseId,
    before.toISOString(),
  ]);
  return (await hydrate(db, rows))[0] ?? null;
}

/** Records for every exercise that has been logged, worked out from history. */
export async function allRecords(db: Db): Promise<{ exercise: Exercise; records: ExerciseRecords; lastAt: string }[]> {
  const logged = await db.getAll<{ exercise_id: string; last_at: string }>(
    `SELECT we.exercise_id, max(w.started_at) AS last_at FROM workout_exercise we JOIN workout w ON w.id = we.workout_id
     GROUP BY we.exercise_id ORDER BY last_at DESC`,
  );
  const exercises = new Map((await listExercises(db, {})).map((e) => [e.id, e]));
  const result = [];
  for (const row of logged) {
    const exercise = exercises.get(row.exercise_id) ?? (await getExercise(db, row.exercise_id));
    if (!exercise) continue;
    result.push({ exercise, records: exerciseRecords(await setsForExercise(db, row.exercise_id)), lastAt: row.last_at });
  }
  return result;
}
