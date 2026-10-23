import type { Migration } from './index';

// The last reps of a set done with a spotter's help. NULL when none (every set logged before this).
export const assistedReps: Migration = {
  version: 15,
  name: 'assisted_reps',
  async up(db) {
    await db.exec('ALTER TABLE workout_set ADD COLUMN assisted_reps INTEGER CHECK (assisted_reps IS NULL OR assisted_reps >= 1)');
  },
};
