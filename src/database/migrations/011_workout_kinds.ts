import { nowIso } from '../ids';
import { exerciseId } from '../seed/exercises';

import type { Migration } from './index';

const REPS_ONLY = [
  'Chest dip',
  'Push-up',
  'Pull-up',
  'Chin-up',
  'Back extension',
  'Triceps dip',
  'Diamond push-up',
  'Hanging leg raise',
  'Ab wheel rollout',
  'Russian twist',
  'Decline sit-up',
  'Dead bug',
  'Burpee',
];
const TIMED = ['Plank'];
const CLASS_TYPES: [id: string, name: string][] = [
  ['class_hyrox', 'Hyrox'],
  ['class_spin', 'Spin'],
  ['class_hiit', 'HIIT'],
  ['class_run', 'Run'],
];

// How each exercise is logged (weight × reps, reps only, or a time), and classes such as Hyrox.
export const workoutKinds: Migration = {
  version: 11,
  name: 'workout kinds',
  async up(db) {
    await db.exec(`
ALTER TABLE exercise ADD COLUMN tracking TEXT NOT NULL DEFAULT 'weight_reps' CHECK (tracking IN ('weight_reps', 'reps', 'time'));
CREATE TABLE class_type (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0 CHECK (is_custom IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE TABLE class_session (
  id TEXT PRIMARY KEY NOT NULL,
  class_type_id TEXT NOT NULL REFERENCES class_type (id),
  started_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 1 AND 600),
  effort INTEGER CHECK (effort IS NULL OR effort BETWEEN 1 AND 10),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_class_session_started ON class_session (started_at);
`);
    for (const name of REPS_ONLY) await db.run("UPDATE exercise SET tracking = 'reps' WHERE id = ?", [exerciseId(name)]);
    for (const name of TIMED) await db.run("UPDATE exercise SET tracking = 'time' WHERE id = ?", [exerciseId(name)]);
    const now = nowIso();
    for (const [id, name] of CLASS_TYPES) {
      await db.run('INSERT INTO class_type (id, name, is_custom, created_at) VALUES (?, ?, 0, ?)', [id, name, now]);
    }
  },
};
