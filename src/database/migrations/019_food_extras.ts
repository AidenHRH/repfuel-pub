import type { Migration } from './index';

// 0.24: sugar as a secondary nutrient (on foods and on each entry's snapshot), the shop a food came from, and the size
// of one piece ("1 Malteser" weighs 5 g) so foods can be logged by the piece. All optional: unknown stays null.
export const foodExtras: Migration = {
  version: 19,
  name: 'food_extras',
  async up(db) {
    await db.exec(`
      ALTER TABLE food_product ADD COLUMN sugar_g REAL CHECK (sugar_g IS NULL OR sugar_g >= 0);
      ALTER TABLE food_log_entry ADD COLUMN sugar_g REAL CHECK (sugar_g IS NULL OR sugar_g >= 0);
      ALTER TABLE food_product ADD COLUMN shop TEXT;
      ALTER TABLE food_product ADD COLUMN piece_g REAL CHECK (piece_g IS NULL OR piece_g > 0);
      ALTER TABLE food_product ADD COLUMN piece_label TEXT;
    `);
  },
};
