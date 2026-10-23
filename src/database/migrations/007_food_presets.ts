import type { Migration } from './index';

// Which built-in common food (e.g. "blueberries") a saved food came from, so it's saved only once.
export const foodPresets: Migration = {
  version: 7,
  name: 'common food links',
  async up(db) {
    await db.exec(`ALTER TABLE food_product ADD COLUMN preset_id TEXT;`);
  },
};
