import type { Migration } from './index';

// A product's health information from Open Food Facts: Nutri-Score, NOVA processing group and additives.
export const foodHealth: Migration = {
  version: 9,
  name: 'food health information',
  async up(db) {
    await db.exec(`
ALTER TABLE food_product ADD COLUMN nutriscore TEXT CHECK (nutriscore IS NULL OR nutriscore IN ('a', 'b', 'c', 'd', 'e'));
ALTER TABLE food_product ADD COLUMN nova INTEGER CHECK (nova IS NULL OR nova BETWEEN 1 AND 4);
ALTER TABLE food_product ADD COLUMN additives_json TEXT;
`);
  },
};
