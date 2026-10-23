import { nowIso } from '../ids';
import { exerciseId, STARTER_EXERCISES } from '../seed/exercises';

import type { Migration } from './index';

// Seeds the starter exercise library so lifts can be logged straight away.
export const exerciseLibrary: Migration = {
  version: 4,
  name: 'starter exercise library',
  async up(db) {
    const now = nowIso();
    for (const [name, group, equipment, bodyweight] of STARTER_EXERCISES) {
      await db.run(
        `INSERT OR IGNORE INTO exercise (id, name, muscle_group, equipment, is_bodyweight, is_custom, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [exerciseId(name), name, group, equipment, bodyweight ? 1 : 0, now],
      );
    }
  },
};
