import type { Migration } from './index';

// A recipe ingredient is now either a food or a share (portions) of another recipe,
// so a meal can include part of a batch such as a pico salad. SQLite can't relax a
// NOT NULL column in place, so the table is rebuilt and its rows copied across.
export const recipeComponents: Migration = {
  version: 2,
  name: 'recipe ingredients can be other recipes',
  async up(db) {
    await db.exec(`
CREATE TABLE recipe_ingredient_new (
  id TEXT PRIMARY KEY NOT NULL,
  recipe_id TEXT NOT NULL REFERENCES recipe (id) ON DELETE CASCADE,
  food_product_id TEXT REFERENCES food_product (id),
  sub_recipe_id TEXT REFERENCES recipe (id),
  amount REAL NOT NULL CHECK (amount > 0),
  unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'serving', 'portion')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  CHECK ((food_product_id IS NULL) <> (sub_recipe_id IS NULL)),
  CHECK (sub_recipe_id IS NULL OR unit = 'portion'),
  CHECK (food_product_id IS NULL OR unit <> 'portion')
);
INSERT INTO recipe_ingredient_new (id, recipe_id, food_product_id, sub_recipe_id, amount, unit, sort_order)
  SELECT id, recipe_id, food_product_id, NULL, amount, unit, sort_order FROM recipe_ingredient;
DROP TABLE recipe_ingredient;
ALTER TABLE recipe_ingredient_new RENAME TO recipe_ingredient;
CREATE INDEX idx_recipe_ingredient_recipe ON recipe_ingredient (recipe_id);
CREATE INDEX idx_recipe_ingredient_sub_recipe ON recipe_ingredient (sub_recipe_id);
`);
  },
};
