import type { MuscleGroup } from '@/domain/exercises';
import type { ClassEffort, ProgressSet } from '@/domain/progressStats';

import type { Db } from '../Db';

type Row = {
  workout_id: string;
  started_at: string;
  exercise_id: string;
  exercise_name: string;
  muscle_group: MuscleGroup;
  weight_kg: number | null;
  repetitions: number | null;
  duration_seconds: number | null;
  effort: number | null;
  assisted_reps: number | null;
};

/** Every completed set with its exercise, oldest first, for the Progress charts. */
export async function allLiftSets(db: Db): Promise<ProgressSet[]> {
  const rows = await db.getAll<Row>(
    `SELECT w.id AS workout_id, w.started_at, e.id AS exercise_id, e.name AS exercise_name, e.muscle_group,
            s.weight_kg, s.repetitions, s.duration_seconds, s.effort, s.assisted_reps
     FROM workout_set s
     JOIN workout_exercise we ON we.id = s.workout_exercise_id
     JOIN workout w ON w.id = we.workout_id
     JOIN exercise e ON e.id = we.exercise_id
     WHERE s.is_completed = 1 AND (s.repetitions IS NOT NULL OR s.duration_seconds IS NOT NULL)
     ORDER BY w.started_at, s.set_number`,
  );
  return rows.map((r) => ({
    workoutId: r.workout_id,
    at: r.started_at,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    muscleGroup: r.muscle_group,
    weightKg: r.weight_kg,
    reps: r.repetitions,
    effort: r.effort,
    ...(r.duration_seconds !== null ? { durationSeconds: r.duration_seconds } : {}),
    ...(r.assisted_reps !== null ? { assistedReps: r.assisted_reps } : {}),
  }));
}

/** When each class was and how hard it felt. */
export async function classEfforts(db: Db): Promise<ClassEffort[]> {
  const rows = await db.getAll<{ started_at: string; effort: number | null }>(
    'SELECT started_at, effort FROM class_session ORDER BY started_at',
  );
  return rows.map((r) => ({ at: r.started_at, effort: r.effort }));
}
