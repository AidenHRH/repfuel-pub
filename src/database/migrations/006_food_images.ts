import type { Migration } from './index';

// A picture of the pack (from Open Food Facts) for foods found by search or barcode.
export const foodImages: Migration = {
  version: 6,
  name: 'food pictures',
  async up(db) {
    await db.exec(`ALTER TABLE food_product ADD COLUMN image_url TEXT;`);
  },
};
