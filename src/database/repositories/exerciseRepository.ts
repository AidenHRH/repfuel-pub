import type { Equipment, Exercise, MuscleGroup, Tracking } from '@/domain/exercises';
import { youTubeId } from '@/domain/howTo';

import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

type Row = {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  is_bodyweight: number;
  is_custom: number;
  tracking: Tracking;
  video_url?: string | null;
};

const toExercise = (r: Row): Exercise => ({
  id: r.id,
  name: r.name,
  muscleGroup: r.muscle_group,
  equipment: r.equipment,
  isBodyweight: r.is_bodyweight === 1,
  isCustom: r.is_custom === 1,
  tracking: r.tracking,
  videoUrl: r.video_url ?? null,
});

export async function listExercises(db: Db, { search, group }: { search?: string; group?: MuscleGroup }): Promise<Exercise[]> {
  const term = search?.trim().toLowerCase() ?? '';
  const rows = await db.getAll<Row>(
    `SELECT * FROM exercise WHERE archived_at IS NULL AND instr(lower(name), ?) > 0 AND (? IS NULL OR muscle_group = ?)
     ORDER BY name COLLATE NOCASE`,
    [term, group ?? null, group ?? null],
  );
  return rows.map(toExercise);
}

export async function getExercise(db: Db, id: string): Promise<Exercise | null> {
  const row = await db.getFirst<Row>('SELECT * FROM exercise WHERE id = ?', [id]);
  return row ? toExercise(row) : null;
}

export async function createExercise(
  db: Db,
  input: { name: string; muscleGroup: MuscleGroup; equipment: Equipment; isBodyweight: boolean; tracking?: Tracking },
): Promise<Exercise> {
  const name = input.name.trim();
  if (!name) throw new RangeError('An exercise needs a name');
  const clash = await db.getFirst<{ name: string }>(
    'SELECT name FROM exercise WHERE lower(name) = lower(?) AND archived_at IS NULL',
    [name],
  );
  if (clash) throw new Error(`${clash.name} is already in your exercises`);
  const id = newId();
  await db.run(
    `INSERT INTO exercise (id, name, muscle_group, equipment, is_bodyweight, is_custom, tracking, created_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, name, input.muscleGroup, input.equipment, input.isBodyweight ? 1 : 0, input.tracking ?? 'weight_reps', nowIso()],
  );
  return (await getExercise(db, id))!;
}

/** Exercises logged most recently, newest first, each once (for quick picks in Log workout). */
export async function recentExercises(db: Db, limit = 6): Promise<Exercise[]> {
  const rows = await db.getAll<Row>(
    `SELECT e.* FROM exercise e JOIN workout_exercise we ON we.exercise_id = e.id JOIN workout w ON w.id = we.workout_id
     WHERE e.archived_at IS NULL GROUP BY e.id ORDER BY max(w.started_at) DESC LIMIT ?`,
    [limit],
  );
  return rows.map(toExercise);
}

/** Saves the owner's how-to video for an exercise (null removes it). Only YouTube video links. */
export async function setExerciseVideo(db: Db, id: string, url: string | null): Promise<void> {
  const link = url?.trim() || null;
  if (link !== null && youTubeId(link) === null) throw new RangeError('That isn’t a YouTube video link.');
  await db.run('UPDATE exercise SET video_url = ? WHERE id = ?', [link, id]);
}
