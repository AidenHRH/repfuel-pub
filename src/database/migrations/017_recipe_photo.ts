import type { Migration } from './index';

// The owner's own photo of a recipe (a file kept in the app's documents), by recipe ref ("template:turkey-chilli").
export const recipePhoto: Migration = {
  version: 17,
  name: 'recipe_photo',
  async up(db) {
    await db.exec(`
CREATE TABLE recipe_photo (
  recipe_ref TEXT PRIMARY KEY NOT NULL,
  file_uri TEXT NOT NULL,
  added_at TEXT NOT NULL
);`);
  },
};
