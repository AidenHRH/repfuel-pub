import type { Db } from '../Db';
import { newId, nowIso } from '../ids';

export type ClassType = { id: string; name: string; isCustom: boolean };

export type ClassSession = {
  id: string;
  classTypeId: string;
  className: string;
  at: string;
  durationMin: number;
  /** How hard it felt, 1–10; null when not rated. */
  effort: number | null;
  notes: string | null;
};

export type ClassInput = { classTypeId: string; at: Date; durationMin: number; effort: number | null; notes: string | null };

type Row = {
  id: string;
  class_type_id: string;
  class_name: string;
  started_at: string;
  duration_min: number;
  effort: number | null;
  notes: string | null;
};

const SELECT = `SELECT c.id, c.class_type_id, t.name AS class_name, c.started_at, c.duration_min, c.effort, c.notes
  FROM class_session c JOIN class_type t ON t.id = c.class_type_id`;

const toSession = (r: Row): ClassSession => ({
  id: r.id,
  classTypeId: r.class_type_id,
  className: r.class_name,
  at: r.started_at,
  durationMin: r.duration_min,
  effort: r.effort,
  notes: r.notes,
});

function validate(input: ClassInput) {
  if (!Number.isInteger(input.durationMin) || input.durationMin < 1 || input.durationMin > 600) {
    throw new RangeError('A class lasts from 1 minute to 10 hours');
  }
  if (input.effort !== null && (!Number.isInteger(input.effort) || input.effort < 1 || input.effort > 10)) {
    throw new RangeError('Effort is 1 to 10');
  }
}

async function requireType(db: Db, id: string) {
  const row = await db.getFirst<{ id: string }>('SELECT id FROM class_type WHERE id = ?', [id]);
  if (!row) throw new Error('Class not found');
}

const cleanNotes = (notes: string | null) => notes?.trim() || null;

/** Built-in classes first (Hyrox, Spin, HIIT, Run), then the owner's own by name. */
export async function listClassTypes(db: Db): Promise<ClassType[]> {
  const rows = await db.getAll<{ id: string; name: string; is_custom: number }>(
    'SELECT id, name, is_custom FROM class_type ORDER BY is_custom, CASE WHEN is_custom = 0 THEN rowid END, name COLLATE NOCASE',
  );
  return rows.map((r) => ({ id: r.id, name: r.name, isCustom: r.is_custom === 1 }));
}

export async function addClassType(db: Db, raw: string): Promise<ClassType> {
  const name = raw.trim();
  if (!name) throw new RangeError('A class needs a name');
  const clash = await db.getFirst<{ name: string }>('SELECT name FROM class_type WHERE lower(name) = lower(?)', [name]);
  if (clash) throw new Error(`${clash.name} is already a class`);
  const id = newId();
  await db.run('INSERT INTO class_type (id, name, is_custom, created_at) VALUES (?, ?, 1, ?)', [id, name, nowIso()]);
  return { id, name, isCustom: true };
}

export async function getClass(db: Db, id: string): Promise<ClassSession | null> {
  const row = await db.getFirst<Row>(`${SELECT} WHERE c.id = ?`, [id]);
  return row ? toSession(row) : null;
}

export async function logClass(db: Db, input: ClassInput): Promise<ClassSession> {
  validate(input);
  await requireType(db, input.classTypeId);
  const id = newId();
  const now = nowIso();
  await db.run(
    `INSERT INTO class_session (id, class_type_id, started_at, duration_min, effort, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.classTypeId, input.at.toISOString(), input.durationMin, input.effort, cleanNotes(input.notes), now, now],
  );
  return (await getClass(db, id))!;
}

export async function updateClass(db: Db, id: string, input: ClassInput): Promise<void> {
  validate(input);
  await requireType(db, input.classTypeId);
  await db.run(
    'UPDATE class_session SET class_type_id = ?, started_at = ?, duration_min = ?, effort = ?, notes = ?, updated_at = ? WHERE id = ?',
    [input.classTypeId, input.at.toISOString(), input.durationMin, input.effort, cleanNotes(input.notes), nowIso(), id],
  );
}

export async function deleteClass(db: Db, id: string): Promise<void> {
  await db.run('DELETE FROM class_session WHERE id = ?', [id]);
}

export async function recentClasses(db: Db, limit = 30): Promise<ClassSession[]> {
  const rows = await db.getAll<Row>(`${SELECT} ORDER BY c.started_at DESC LIMIT ?`, [limit]);
  return rows.map(toSession);
}
