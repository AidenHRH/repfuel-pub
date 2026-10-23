import type { Migration } from './index';

// The size of the whole pack (300 g bag, 1000 ml carton) in the food's own unit, for "1 pack" and "150 g of a
// 300 g pack". Unknown is NULL; foods saved before this get it the next time they're scanned.
export const packSize: Migration = {
  version: 13,
  name: 'pack_size',
  async up(db) {
    await db.exec('ALTER TABLE food_product ADD COLUMN pack_size REAL CHECK (pack_size IS NULL OR pack_size > 0)');
  },
};
