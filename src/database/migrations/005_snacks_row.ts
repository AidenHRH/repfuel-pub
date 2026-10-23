import type { Migration } from './index';

// Saved foods the owner picks to show as one-tap tiles in "Snacks & drinks" on Today.
export const snacksRow: Migration = {
  version: 5,
  name: 'snacks and drinks row',
  async up(db) {
    await db.exec(
      `ALTER TABLE food_product ADD COLUMN in_snacks_row INTEGER NOT NULL DEFAULT 0 CHECK (in_snacks_row IN (0, 1));`,
    );
  },
};
