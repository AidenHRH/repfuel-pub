import type { Migration } from './index';

// How much creatine was taken each day (the day's total, in g). Days ticked before this keep NULL: amount unknown.
export const creatineAmounts: Migration = {
  version: 14,
  name: 'creatine_amounts',
  async up(db) {
    await db.exec('ALTER TABLE reminder_done ADD COLUMN amount_g REAL CHECK (amount_g IS NULL OR amount_g > 0)');
  },
};
