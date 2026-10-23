import { Directory, File, Paths } from 'expo-file-system';

import type { Db } from '../Db';
import { nowIso } from '../ids';

/** The owner's photo of a recipe ("template:turkey-chilli"), as a file on the phone, or null. */
export async function getRecipePhoto(db: Db, ref: string): Promise<string | null> {
  const row = await db.getFirst<{ file_uri: string }>('SELECT file_uri FROM recipe_photo WHERE recipe_ref = ?', [ref]);
  return row?.file_uri ?? null;
}

/** Keeps a copy of a picked or taken photo in the app's documents and makes it the recipe's photo. */
export async function setRecipePhoto(db: Db, ref: string, sourceUri: string): Promise<string> {
  const folder = new Directory(Paths.document, 'recipe-photos');
  if (!folder.exists) folder.create();
  const target = new File(folder, `${ref.replace(/[^a-z0-9-]+/gi, '_')}-${Date.now()}.jpg`);
  new File(sourceUri).copy(target);
  const previous = await getRecipePhoto(db, ref);
  await db.run(
    `INSERT INTO recipe_photo (recipe_ref, file_uri, added_at) VALUES (?, ?, ?)
     ON CONFLICT (recipe_ref) DO UPDATE SET file_uri = excluded.file_uri, added_at = excluded.added_at`,
    [ref, target.uri, nowIso()],
  );
  if (previous) removeFile(previous);
  return target.uri;
}

export async function removeRecipePhoto(db: Db, ref: string): Promise<void> {
  const previous = await getRecipePhoto(db, ref);
  await db.run('DELETE FROM recipe_photo WHERE recipe_ref = ?', [ref]);
  if (previous) removeFile(previous);
}

function removeFile(uri: string) {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // An old photo that can't be removed only takes a little space.
  }
}
